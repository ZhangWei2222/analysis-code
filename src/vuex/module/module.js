import { forEachValue } from "../util";

// store 的模块 基础数据结构，包括一些属性和方法
export default class Module {
  constructor(rawModule, runtime) {
    // 接收参数 runtime
    this.runtime = runtime;
    // 存储子模块
    this._children = Object.create(null);
    // 存储原始未加工的模块
    this._rawModule = rawModule;
    // 模块 state
    const rawState = rawModule.state;

    // 原始Store 可能是函数，也可能是是对象，是假值，则赋值空对象。
    this.state = (typeof rawState === "function" ? rawState() : rawState) || {};
  }

  get namespaced() {
    return !!this._rawModule.namespaced;
  }

  addChild(key, module) {
    this._children[key] = module;
  }

  removeChild(key) {
    delete this._children[key];
  }

  getChild(key) {
    return this._children[key];
  }

  update(rawModule) {
    this._rawModule.namespaced = rawModule.namespaced;
    if (rawModule.actions) {
      this._rawModule.actions = rawModule.actions;
    }
    if (rawModule.mutations) {
      this._rawModule.mutations = rawModule.mutations;
    }
    if (rawModule.getters) {
      this._rawModule.getters = rawModule.getters;
    }
  }

  forEachChild(fn) {
    forEachValue(this._children, fn);
  }

  forEachGetter(fn) {
    if (this._rawModule.getters) {
      forEachValue(this._rawModule.getters, fn);
    }
  }

  forEachAction(fn) {
    if (this._rawModule.actions) {
      forEachValue(this._rawModule.actions, fn);
    }
  }

  forEachMutation(fn) {
    if (this._rawModule.mutations) {
      forEachValue(this._rawModule.mutations, fn);
    }
  }
}
