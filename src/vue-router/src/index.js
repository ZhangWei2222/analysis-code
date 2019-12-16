/* @flow */

import { install } from "./install";
import { START } from "./util/route";
import { assert } from "./util/warn";
import { inBrowser } from "./util/dom";
import { cleanPath } from "./util/path";
import { createMatcher } from "./create-matcher";
import { normalizeLocation } from "./util/location";
import { supportsPushState } from "./util/push-state";

import { HashHistory } from "./history/hash";
import { HTML5History } from "./history/html5";
import { AbstractHistory } from "./history/abstract";

import type { Matcher } from "./create-matcher";

export default class VueRouter {
  static install: () => void;
  static version: string;

  app: any;
  apps: Array<any>;
  ready: boolean;
  readyCbs: Array<Function>;
  options: RouterOptions;
  mode: string;
  history: HashHistory | HTML5History | AbstractHistory;
  matcher: Matcher;
  fallback: boolean;
  beforeHooks: Array<?NavigationGuard>;
  resolveHooks: Array<?NavigationGuard>;
  afterHooks: Array<?AfterNavigationHook>;

  constructor(options: RouterOptions = {}) {
    this.app = null;
    this.apps = [];
    this.options = options;
    this.beforeHooks = [];
    this.resolveHooks = [];
    this.afterHooks = [];
    // 路由匹配对象
    this.matcher = createMatcher(options.routes || [], this);

    // 根据 mode 采取不同的路由方式
    let mode = options.mode || "hash";
    this.fallback =
      mode === "history" && !supportsPushState && options.fallback !== false;
    if (this.fallback) {
      mode = "hash";
    }
    if (!inBrowser) {
      mode = "abstract";
    }
    this.mode = mode;

    switch (mode) {
      case "history":
        this.history = new HTML5History(this, options.base);
        break;
      case "hash":
        this.history = new HashHistory(this, options.base, this.fallback);
        break;
      case "abstract":
        this.history = new AbstractHistory(this, options.base);
        break;
      default:
        if (process.env.NODE_ENV !== "production") {
          assert(false, `invalid mode: ${mode}`);
        }
    }
  }

  // 使用：this.$router.match('/count')
  // 输入参数raw（/user/4739284722这种形式,类似route的path），current，redirectedFrom，结果返回匹配route
  match(raw: RawLocation, current?: Route, redirectedFrom?: Location): Route {
    return this.matcher.match(raw, current, redirectedFrom);
  }

  // 使用：this.$router.currentRoute
  // 用于获取当前history.current，也就是当前route，包括path、component、meta等
  get currentRoute(): ?Route {
    return this.history && this.history.current;
  }

  // 初始化路由
  init(app: any /* Vue component instance */) {
    // assert是个断言，测试install.installed是否为真，为真，则说明vueRouter已经安装了
    process.env.NODE_ENV !== "production" &&
      assert(
        install.installed,
        `not installed. Make sure to call \`Vue.use(VueRouter)\` ` +
          `before creating root instance.`
      );

    // 保存组件实例：将vue实例推到apps列表中，install里面最初是将vue根实例推进去的
    this.apps.push(app);

    // set up app destroyed handler
    // https://github.com/vuejs/vue-router/issues/2639
    // app被destroyed时候，会$emit ‘hook:destroyed’事件，监听这个事件，执行下面方法
    // 从apps 里将app移除
    app.$once("hook:destroyed", () => {
      // clean out app from this.apps array once destroyed
      const index = this.apps.indexOf(app);
      if (index > -1) this.apps.splice(index, 1);
      // ensure we still have a main app or null if no apps
      // we do not release the router so it can be reused
      if (this.app === app) this.app = this.apps[0] || null;
    });

    // 如果根组件已经有了就返回
    if (this.app) {
      return;
    }

    // 赋值路由模式
    this.app = app;

    const history = this.history;

    // 判断路由模式，并根据不同路由模式进行跳转。hashHistory需要监听hashchange和popshate两个事件，而html5History监听popstate事件
    if (history instanceof HTML5History) {
      history.transitionTo(history.getCurrentLocation());
    } else if (history instanceof HashHistory) {
      // 添加 hashchange 监听
      const setupHashListener = () => {
        history.setupListeners();
      };
      // 路由跳转
      history.transitionTo(
        history.getCurrentLocation(),
        setupHashListener,
        setupHashListener
      );
    }

    // 该回调会在 transitionTo 中调用
    // 对组件的 _route 属性进行赋值，触发组件渲染；且将apps中的组件的_route全部更新至最新的
    history.listen(route => {
      this.apps.forEach(app => {
        app._route = route;
      });
    });
  }

  // 将回调方法fn注册到beforeHooks里。registerHook会返回，fn执行后的callback方法，功能是将fn从beforeHooks删除
  beforeEach(fn: Function): Function {
    return registerHook(this.beforeHooks, fn);
  }

  // 将回调方法fn注册到resolveHooks里。registerHook会返回，fn执行后的callback方法，功能是将fn从resolveHooks删除
  beforeResolve(fn: Function): Function {
    return registerHook(this.resolveHooks, fn);
  }

  // 将回调方法fn注册到afterHooks里。registerHook会返回，fn执行后的callback方法，功能是将fn从afterHooks删除
  afterEach(fn: Function): Function {
    return registerHook(this.afterHooks, fn);
  }

  // 添加一个回调函数，它会在首次路由跳转完成时被调用，此方法通常用于等待异步的导航钩子完成，比如在进行服务端渲染中
  onReady(cb: Function, errorCb?: Function) {
    this.history.onReady(cb, errorCb);
  }

  // 报错
  onError(errorCb: Function) {
    this.history.onError(errorCb);
  }

  // 新增路由跳转
  push(location: RawLocation, onComplete?: Function, onAbort?: Function) {
    // $flow-disable-line
    if (!onComplete && !onAbort && typeof Promise !== "undefined") {
      return new Promise((resolve, reject) => {
        this.history.push(location, resolve, reject);
      });
    } else {
      this.history.push(location, onComplete, onAbort);
    }
  }

  // 路由替换
  replace(location: RawLocation, onComplete?: Function, onAbort?: Function) {
    // $flow-disable-line
    if (!onComplete && !onAbort && typeof Promise !== "undefined") {
      return new Promise((resolve, reject) => {
        this.history.replace(location, resolve, reject);
      });
    } else {
      this.history.replace(location, onComplete, onAbort);
    }
  }

  // 前进n条路由
  go(n: number) {
    this.history.go(n);
  }

  // 后退一步
  back() {
    this.go(-1);
  }

  // 前进一步
  forward() {
    this.go(1);
  }

  // 使用：this.$router.getMatchedComponents("/")或者
  // this.$router.getMatchedComponents({path: "/count",name: "count"})
  // 返回匹配的组件
  getMatchedComponents(to?: RawLocation | Route): Array<any> {
    const route: any = to
      ? to.matched
        ? to
        : this.resolve(to).route
      : this.currentRoute;
    if (!route) {
      return [];
    }
    return [].concat.apply(
      [],
      route.matched.map(m => {
        return Object.keys(m.components).map(key => {
          return m.components[key];
        });
      })
    );
  }

  // 如果this.$router.getMatchedComponents("/")参数是个path，会来到这里解析
  resolve(
    to: RawLocation,
    current?: Route,
    append?: boolean
  ): {
    location: Location,
    route: Route,
    href: string,
    // for backwards compat
    normalizedTo: Location,
    resolved: Route
  } {
    current = current || this.history.current;
    const location = normalizeLocation(to, current, append, this);
    const route = this.match(location, current);
    const fullPath = route.redirectedFrom || route.fullPath;
    const base = this.history.base;
    const href = createHref(base, fullPath, this.mode);
    return {
      location,
      route,
      href,
      // for backwards compat
      normalizedTo: location,
      resolved: route
    };
  }

  // 动态新增路由
  addRoutes(routes: Array<RouteConfig>) {
    this.matcher.addRoutes(routes);
    // START是啥？？？？？？？
    if (this.history.current !== START) {
      this.history.transitionTo(this.history.getCurrentLocation());
    }
  }
}

// 将callback（参数fn）插入list，返回一个方法，方法实现的是从list中删除fn。也就是在callback执行后，通过调用这个方法，可以将fn从list中移除
function registerHook(list: Array<any>, fn: Function): Function {
  list.push(fn);
  return () => {
    const i = list.indexOf(fn);
    if (i > -1) list.splice(i, 1);
  };
}

// 建立路由在浏览器中显示的格式
function createHref(base: string, fullPath: string, mode) {
  var path = mode === "hash" ? "#" + fullPath : fullPath;
  return base ? cleanPath(base + "/" + path) : path;
}

VueRouter.install = install;
VueRouter.version = "__VERSION__";

if (inBrowser && window.Vue) {
  window.Vue.use(VueRouter);
}
