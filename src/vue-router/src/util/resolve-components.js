/* @flow */

import { _Vue } from "../install";
import { warn, isError } from "./warn";

// 解析异步组件
export function resolveAsyncComponents(matched: Array<RouteRecord>): Function {
  return (to, from, next) => {
    let hasAsync = false;
    let pending = 0;
    let error = null;

    flatMapComponents(matched, (def, _, match, key) => {
      // vue-router 没使用 Vue 核心库解析异步组件的函数，原因是希望能够实现停止路由跳转知道懒加载的组件被解析成功

      // 判断是否是异步组件
      if (typeof def === "function" && def.cid === undefined) {
        hasAsync = true;
        pending++;

        // 成功回调
        // once 函数确保异步组件只加载一次
        const resolve = once(resolvedDef => {
          if (isESModule(resolvedDef)) {
            resolvedDef = resolvedDef.default;
          }
          // 判断是否是构造函数
          // 不是的话通过 Vue 来生成组件构造函数
          def.resolved =
            typeof resolvedDef === "function"
              ? resolvedDef
              : _Vue.extend(resolvedDef);
          // 赋值组件
          // 如果组件全部解析完毕，继续下一步
          match.components[key] = resolvedDef;
          pending--;
          if (pending <= 0) {
            next();
          }
        });

        // 失败回调
        const reject = once(reason => {
          const msg = `Failed to resolve async component ${key}: ${reason}`;
          process.env.NODE_ENV !== "production" && warn(false, msg);
          if (!error) {
            error = isError(reason) ? reason : new Error(msg);
            next(error);
          }
        });

        let res;
        try {
          // 执行异步组件函数
          res = def(resolve, reject);
        } catch (e) {
          reject(e);
        }
        if (res) {
          // 下载完成执行回调
          if (typeof res.then === "function") {
            res.then(resolve, reject);
          } else {
            // new syntax in Vue 2.3
            const comp = res.component;
            if (comp && typeof comp.then === "function") {
              comp.then(resolve, reject);
            }
          }
        }
      }
    });

    // 不是异步组件直接下一步
    if (!hasAsync) next();
  };
}

export function flatMapComponents(
  matched: Array<RouteRecord>,
  fn: Function
): Array<?Function> {
  // 数组降维
  return flatten(
    matched.map(m => {
      // 将组件中的对象传入回调函数中，获得钩子函数数组
      return Object.keys(m.components).map(key =>
        fn(
          m.components[key], // 组件、懒加载函数
          m.instances[key], // 实例
          m, // 路由记录
          key // 视图名（一般为default）
        )
      );
    })
  );
}

export function flatten(arr: Array<any>): Array<any> {
  return Array.prototype.concat.apply([], arr);
}

const hasSymbol =
  typeof Symbol === "function" && typeof Symbol.toStringTag === "symbol";

function isESModule(obj) {
  return obj.__esModule || (hasSymbol && obj[Symbol.toStringTag] === "Module");
}

// in Webpack 2, require.ensure now also returns a Promise
// so the resolve/reject functions may get called an extra time
// if the user uses an arrow function shorthand that happens to
// return that Promise.
function once(fn) {
  let called = false;
  return function(...args) {
    if (called) return;
    called = true;
    return fn.apply(this, args);
  };
}
