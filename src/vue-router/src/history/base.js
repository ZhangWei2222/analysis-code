/* @flow */

import { _Vue } from "../install";
import type Router from "../index";
import { inBrowser } from "../util/dom";
import { runQueue } from "../util/async";
import { warn, isError, isExtendedError } from "../util/warn";
import { START, isSameRoute } from "../util/route";
import {
  flatten,
  flatMapComponents,
  resolveAsyncComponents
} from "../util/resolve-components";
import { NavigationDuplicated } from "./errors";

export class History {
  router: Router;
  base: string;
  current: Route;
  pending: ?Route;
  cb: (r: Route) => void;
  ready: boolean;
  readyCbs: Array<Function>;
  readyErrorCbs: Array<Function>;
  errorCbs: Array<Function>;

  // implemented by sub-classes
  +go: (n: number) => void;
  +push: (loc: RawLocation) => void;
  +replace: (loc: RawLocation) => void;
  +ensureURL: (push?: boolean) => void;
  +getCurrentLocation: () => string;

  constructor(router: Router, base: ?string) {
    // 获取当前router
    this.router = router;
    // 获取路由base
    this.base = normalizeBase(base);
    // 由createRoute生成的基础路由，path:'/'
    this.current = START;
    this.pending = null;
    this.ready = false;
    this.readyCbs = [];
    this.readyErrorCbs = [];
    this.errorCbs = [];
  }

  // listen callback
  listen(cb: Function) {
    this.cb = cb;
  }

  // 监听路由是否ready,ready时，将所有cb装进readyCbs列表
  onReady(cb: Function, errorCb: ?Function) {
    if (this.ready) {
      cb();
    } else {
      this.readyCbs.push(cb);
      if (errorCb) {
        this.readyErrorCbs.push(errorCb);
      }
    }
  }

  onError(errorCb: Function) {
    this.errorCbs.push(errorCb);
  }

  // 路由的跳转，会判断跳转to的路径是否在路由表中：是，才进行组件替换，调用confirmTransition
  transitionTo(
    location: RawLocation,
    onComplete?: Function,
    onAbort?: Function
  ) {
    // 调用 match 得到匹配的 route 对象
    const route = this.router.match(location, this.current);

    // 确认过渡
    this.confirmTransition(
      route,
      () => {
        // 更新路由信息，对组件的 _route 属性进行赋值，触发组件渲染
        // 调用 afterHooks 中的钩子函数
        this.updateRoute(route);
        // 添加 hashchange 监听
        onComplete && onComplete(route);
        // 子类实现的更新url地址
        // 对于 hash 模式的话 就是更新 hash 的值
        // 对于 history 模式的话 就是利用 pushstate / replacestate 来更新
        // 更新 URL
        this.ensureURL();

        // 只执行一次 ready 回调
        if (!this.ready) {
          this.ready = true;
          this.readyCbs.forEach(cb => {
            cb(route);
          });
        }
      },
      err => {
        // 错误处理
        if (onAbort) {
          onAbort(err);
        }
        if (err && !this.ready) {
          this.ready = true;
          this.readyErrorCbs.forEach(cb => {
            cb(err);
          });
        }
      }
    );
  }

  // 确认过渡
  confirmTransition(route: Route, onComplete: Function, onAbort?: Function) {
    const current = this.current;

    // 中断跳转路由函数
    const abort = err => {
      // after merging https://github.com/vuejs/vue-router/pull/2771 we
      // When the user navigates through history through back/forward buttons
      // we do not want to throw the error. We only throw it if directly calling
      // push/replace. That's why it's not included in isError
      if (!isExtendedError(NavigationDuplicated, err) && isError(err)) {
        if (this.errorCbs.length) {
          this.errorCbs.forEach(cb => {
            cb(err);
          });
        } else {
          warn(false, "uncaught error during route navigation:");
          console.error(err);
        }
      }
      onAbort && onAbort(err);
    };

    // 如果是相同 直接返回
    if (
      isSameRoute(route, current) &&
      // in the case the route map has been dynamically appended to
      route.matched.length === current.matched.length
    ) {
      this.ensureURL();
      return abort(new NavigationDuplicated(route));
    }

    // 交叉比对当前路由的路由记录和现在的这个路由的路由记录
    // 以便能准确得到父子路由更新的情况下可以确切的知道
    // 哪些组件可以复用，需要更新、失活
    const { updated, deactivated, activated } = resolveQueue(
      this.current.matched,
      route.matched
    );

    /* NavigationGuard是一个标准的路由守卫的签名，经过 queue 数组内部这些函数的转换最终会返回路由守卫组成的数组
    declare type NavigationGuard = (
      to: Route,
      from: Route,
      next: (to?: RawLocation | false | Function | void) => void
    ) => any
    */
    const queue: Array<?NavigationGuard> = [].concat(
      // 返回离开组件的 beforeRouteLeave 钩子函数 （数组：子 => 父）
      extractLeaveGuards(deactivated),
      // 返回路由实例（全局）的 beforeEach 钩子函数 （数组）
      this.router.beforeHooks,
      // 返回当前组件的 beforeRouteUpdate 钩子函数 （数组：父 => 子）
      extractUpdateHooks(updated),
      // 返回当前组件的 beforeEnter 钩子函数 （数组）
      activated.map(m => m.beforeEnter),
      // 解析异步路由组件（同样会返回一个导航守卫函数的签名，但是用不到 to,from 这两个参数）
      resolveAsyncComponents(activated)
    );

    // 保存路由
    this.pending = route;
    // 迭代器，用于执行 queue 中的导航守卫钩子
    const iterator = (hook: NavigationGuard, next) => {
      // 路由不相等就不跳转路由
      if (this.pending !== route) {
        return abort();
      }
      try {
        // 执行钩子
        hook(route, current, (to: any) => {
          // 只有执行了钩子函数中的 next，才会继续执行下一个钩子函数
          // 否则会暂停跳转
          // 以下逻辑是在判断 next() 中的传参
          if (to === false || isError(to)) {
            // next(false)
            this.ensureURL(true);
            abort(to);
          } else if (
            typeof to === "string" ||
            (typeof to === "object" &&
              (typeof to.path === "string" || typeof to.name === "string"))
          ) {
            // next('/') 或者 next({ path: '/' }) -> 重定向
            abort();
            if (typeof to === "object" && to.replace) {
              this.replace(to);
            } else {
              this.push(to);
            }
          } else {
            // 这里执行 next
            // 也就是执行下面函数 runQueue 中的 step(index + 1)
            next(to);
          }
        });
      } catch (e) {
        abort(e);
      }
    };

    // 经典的同步执行异步函数
    runQueue(queue, iterator, () => {
      // 该回调用于保存 `beforeRouteEnter` 钩子中的回调函数
      const postEnterCbs = [];
      const isValid = () => this.current === route;
      // 当所有异步组件加载完成后，会执行这里的回调，也就是 runQueue 中的 cb()
      // 接下来执行 需要渲染组件的导航守卫钩子
      // beforeRouteEnter 导航守卫钩子
      const enterGuards = extractEnterGuards(activated, postEnterCbs, isValid);
      // beforeResolve 导航守卫钩子
      const queue = enterGuards.concat(this.router.resolveHooks);
      // 在上次的队列执行完成后再执行组件内的钩子
      // 因为需要等异步组件以及是OK的情况下才能执行
      runQueue(queue, iterator, () => {
        // 确保期间还是当前路由
        // 跳转完成
        if (this.pending !== route) {
          return abort();
        }
        this.pending = null;
        // 这里会执行 afterEach 导航守卫钩子
        onComplete(route);
        if (this.router.app) {
          this.router.app.$nextTick(() => {
            postEnterCbs.forEach(cb => {
              cb();
            });
          });
        }
      });
    });
  }

  // 更新路由信息，对组件的 _route 属性进行赋值，触发组件渲染
  // 调用 afterHooks 中的钩子函数
  updateRoute(route: Route) {
    const prev = this.current;
    this.current = route;
    this.cb && this.cb(route);
    this.router.afterHooks.forEach(hook => {
      hook && hook(route, prev);
    });
  }
}

function normalizeBase(base: ?string): string {
  if (!base) {
    if (inBrowser) {
      // respect <base> tag
      const baseEl = document.querySelector("base");
      base = (baseEl && baseEl.getAttribute("href")) || "/";
      // strip full URL origin
      base = base.replace(/^https?:\/\/[^\/]+/, "");
    } else {
      base = "/";
    }
  }
  // make sure there's the starting slash
  if (base.charAt(0) !== "/") {
    base = "/" + base;
  }
  // remove trailing slash
  return base.replace(/\/$/, "");
}

// 交叉比对当前路由的路由记录和现在的这个路由的路由记录
// 以便能准确得到父子路由更新的情况下可以确切的知道
// 哪些组件可以复用，需要更新、失活
function resolveQueue(
  current: Array<RouteRecord>,
  next: Array<RouteRecord>
): {
  updated: Array<RouteRecord>,
  activated: Array<RouteRecord>,
  deactivated: Array<RouteRecord>
} {
  let i;
  const max = Math.max(current.length, next.length);
  for (i = 0; i < max; i++) {
    // 当前路由路径和跳转路由路径不同时跳出遍历
    if (current[i] !== next[i]) {
      break;
    }
  }
  return {
    // 可复用的组件对应路由
    updated: next.slice(0, i),
    // 需要渲染的组件对应路由
    activated: next.slice(i),
    // 失活的组件对应路由
    deactivated: current.slice(i)
  };
}

/*
 ** @records 删除的路由记录
 ** @name beforeRouteLeave，即最终触发的是beforeRouteLeave守卫
 */
function extractGuards(
  records: Array<RouteRecord>,
  name: string,
  bind: Function,
  reverse?: boolean
): Array<?Function> {
  /*
   ** @def 视图名对应的组件配置项（因为 vue-router 支持命名视图所以可能会有多个视图名，大部分情况为 default，及使用默认视图），当是异步路由时，def为异步返回路由的函数
   ** @instance 组件实例
   ** @match 当前遍历到的路由记录
   ** @key 视图名
   */
  const guards = flatMapComponents(records, (def, instance, match, key) => {
    // 找出组件中对应的钩子函数
    const guard = extractGuard(def, name);
    if (guard) {
      // 给每个钩子函数添加上下文对象为组件自身
      return Array.isArray(guard)
        ? guard.map(guard => bind(guard, instance, match, key))
        : bind(guard, instance, match, key);
    }
  });
  // 数组降维，并且判断是否需要翻转数组
  // 因为某些钩子函数需要从子执行到父
  return flatten(reverse ? guards.reverse() : guards);
}

function extractGuard(
  def: Object | Function,
  key: string
): NavigationGuard | Array<NavigationGuard> {
  if (typeof def !== "function") {
    // extend now so that global mixins are applied.
    def = _Vue.extend(def);
  }
  return def.options[key];
}

// 失活的组件钩子
function extractLeaveGuards(deactivated: Array<RouteRecord>): Array<?Function> {
  // 传入需要执行的钩子函数名
  return extractGuards(deactivated, "beforeRouteLeave", bindGuard, true);
}

// 在当前路由改变，但是该组件被复用时调用
function extractUpdateHooks(updated: Array<RouteRecord>): Array<?Function> {
  return extractGuards(updated, "beforeRouteUpdate", bindGuard);
}

function bindGuard(guard: NavigationGuard, instance: ?_Vue): ?NavigationGuard {
  if (instance) {
    return function boundRouteGuard() {
      return guard.apply(instance, arguments);
    };
  }
}

function extractEnterGuards(
  activated: Array<RouteRecord>,
  cbs: Array<Function>,
  isValid: () => boolean
): Array<?Function> {
  // 这里和之前调用导航守卫基本一致
  return extractGuards(
    activated,
    "beforeRouteEnter",
    (guard, _, match, key) => {
      return bindEnterGuard(guard, match, key, cbs, isValid);
    }
  );
}

function bindEnterGuard(
  guard: NavigationGuard,
  match: RouteRecord,
  key: string,
  cbs: Array<Function>,
  isValid: () => boolean
): NavigationGuard {
  return function routeEnterGuard(to, from, next) {
    return guard(to, from, cb => {
      // 判断 cb 是否是函数
      // 是的话就 push 进 postEnterCbs
      if (typeof cb === "function") {
        cbs.push(() => {
          // #750
          // if a router-view is wrapped with an out-in transition,
          // the instance may not have been registered at this time.
          // we will need to poll for registration until current route
          // is no longer valid.
          // 循环直到拿到组件实例
          poll(cb, match.instances, key, isValid);
        });
      }
      next(cb);
    });
  };
}

// 该函数是为了解决 issus #750
// 当 router-view 外面包裹了 mode 为 out-in 的 transition 组件
// 会在组件初次导航到时获得不到组件实例对象
function poll(
  cb: any, // somehow flow cannot infer this is a function
  instances: Object,
  key: string,
  isValid: () => boolean
) {
  if (
    instances[key] &&
    !instances[key]._isBeingDestroyed // do not reuse being destroyed instance
  ) {
    cb(instances[key]);
  } else if (isValid()) {
    // setTimeout 16ms 作用和 nextTick 基本相同
    setTimeout(() => {
      poll(cb, instances, key, isValid);
    }, 16);
  }
}
