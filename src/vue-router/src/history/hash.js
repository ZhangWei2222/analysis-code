/* @flow */

import type Router from "../index";
import { History } from "./base";
import { cleanPath } from "../util/path";
import { getLocation } from "./html5";
import { setupScroll, handleScroll } from "../util/scroll";
import { pushState, replaceState, supportsPushState } from "../util/push-state";

export class HashHistory extends History {
  /**
   * constructor 的作用
   * 1. 通过 super 调用父类构造函数
   * 2. 处理 History 模式，但不支持 History 而被转成 Hash 模式的情况
   * 3. 确保 # 后面有斜杠，没有则加上
   * 4. 实现跳转到 hash 页面，并监听 hash 变化事件
   */
  constructor(router: Router, base: ?string, fallback: boolean) {
    super(router, base);
    // check history fallback deeplinking
    if (fallback && checkFallback(this.base)) {
      return;
    }
    ensureSlash();
  }

  // this is delayed until the app mounts
  // to avoid the hashchange listener being fired too early
  setupListeners() {
    const router = this.router;
    const expectScroll = router.options.scrollBehavior;
    const supportsScroll = supportsPushState && expectScroll;

    if (supportsScroll) {
      setupScroll();
    }

    // 当 hash 路由发生的变化，即页面发生了跳转时，首先取保路由是以斜杠开头的，然后触发守卫导航，最后更换新的 hash 路由
    window.addEventListener(
      supportsPushState ? "popstate" : "hashchange",
      () => {
        const current = this.current;
        // 确保路由是以斜杠开头的
        if (!ensureSlash()) {
          return;
        }
        this.transitionTo(getHash(), route => {
          if (supportsScroll) {
            handleScroll(this.router, route, current, true);
          }
          if (!supportsPushState) {
            replaceHash(route.fullPath);
          }
        });
      }
    );
  }

  push(location: RawLocation, onComplete?: Function, onAbort?: Function) {
    const { current: fromRoute } = this;
    this.transitionTo(
      location,
      route => {
        pushHash(route.fullPath);
        handleScroll(this.router, route, fromRoute, false);
        onComplete && onComplete(route);
      },
      onAbort
    );
  }

  replace(location: RawLocation, onComplete?: Function, onAbort?: Function) {
    const { current: fromRoute } = this;
    this.transitionTo(
      location,
      route => {
        replaceHash(route.fullPath);
        handleScroll(this.router, route, fromRoute, false);
        onComplete && onComplete(route);
      },
      onAbort
    );
  }

  go(n: number) {
    window.history.go(n);
  }

  // 导航栏url替换,当组件被替换后，会调用此方法改变location。至此route切换完成。ready 状态为 true。然后readyCbs被一次执行。根据参数push为true，执行pushHash，false执行replaceHash。
  ensureURL(push?: boolean) {
    const current = this.current.fullPath;
    if (getHash() !== current) {
      push ? pushHash(current) : replaceHash(current);
    }
  }

  getCurrentLocation() {
    return getHash();
  }
}

function checkFallback(base) {
  // 去掉 base 前缀
  const location = getLocation(base);
  // 如果不是以 /# 开头
  if (!/^\/#/.test(location)) {
    window.location.replace(cleanPath(base + "/#" + location));
    // 在 IE9 下以 Hash 方式的 url 切换路由，它会使得整个页面进行刷新，后面的监听 hashchange 不会起作用，所以直接 return 跳出
    return true;
  }
}

// 确保 url 根路径带上斜杠，没有的话则加上
function ensureSlash(): boolean {
  const path = getHash();
  if (path.charAt(0) === "/") {
    return true;
  }
  replaceHash("/" + path);
  return false;
}

// 获取 url 的 # 符号后面的路径
export function getHash(): string {
  // We can't use window.location.hash here because it's not
  // consistent across browsers - Firefox will pre-decode it!
  let href = window.location.href;
  const index = href.indexOf("#");
  // empty path
  if (index < 0) return "";

  href = href.slice(index + 1);
  // decode the hash but not the search or hash
  // as search(query) is already decoded
  // https://github.com/vuejs/vue-router/issues/2708
  const searchIndex = href.indexOf("?");
  if (searchIndex < 0) {
    const hashIndex = href.indexOf("#");
    if (hashIndex > -1) {
      href = decodeURI(href.slice(0, hashIndex)) + href.slice(hashIndex);
    } else href = decodeURI(href);
  } else {
    href = decodeURI(href.slice(0, searchIndex)) + href.slice(searchIndex);
  }

  return href;
}

// 由于 Firefox 浏览器的原因（源码注释里已经写出来了），所以不能通过 window.location.hash 来获取，而是通过 window.location.href 来获取
function getUrl(path) {
  const href = window.location.href;
  const i = href.indexOf("#");
  const base = i >= 0 ? href.slice(0, i) : href;
  return `${base}#${path}`;
}

function pushHash(path) {
  if (supportsPushState) {
    pushState(getUrl(path));
  } else {
    window.location.hash = path;
  }
}

// 更换 # 符号后面的 hash 路由
function replaceHash(path) {
  if (supportsPushState) {
    replaceState(getUrl(path));
  } else {
    window.location.replace(getUrl(path));
  }
}
