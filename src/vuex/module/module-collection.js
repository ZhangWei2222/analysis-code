import Module from "./module";
import { assert, forEachValue } from "../util";

// 收集模块，构造模块树结构
export default class ModuleCollection {
  constructor(rawRootModule) {
    // 注册根模块 参数 rawRootModule 也就是 Vuex.Store 的 options 参数
    // 未加工过的模块（用户自定义的），根模块
    this.register([], rawRootModule, false);
  }

  get(path) {
    return path.reduce((module, key) => {
      return module.getChild(key);
    }, this.root);
  }

  getNamespace(path) {
    let module = this.root;
    return path.reduce((namespace, key) => {
      module = module.getChild(key);
      return namespace + (module.namespaced ? key + "/" : "");
    }, "");
  }

  update(rawRootModule) {
    update([], this.root, rawRootModule);
  }

  /**
   * 注册模块
   * @param {Array} path 路径
   * @param {Object} rawModule 原始未加工的模块
   * @param {Boolean} runtime runtime 默认是 true，动态注册的模块runtime为false
   */
  register(path, rawModule, runtime = true) {
    // 非生产环境 断言判断用户自定义的模块是否符合要求
    if (process.env.NODE_ENV !== "production") {
      assertRawModule(path, rawModule);
    }

    const newModule = new Module(rawModule, runtime);
    if (path.length === 0) {
      this.root = newModule;
    } else {
      const parent = this.get(path.slice(0, -1));
      parent.addChild(path[path.length - 1], newModule);
    }

    // 递归注册子模块
    if (rawModule.modules) {
      forEachValue(rawModule.modules, (rawChildModule, key) => {
        this.register(path.concat(key), rawChildModule, runtime);
      });
    }
  }

  unregister(path) {
    const parent = this.get(path.slice(0, -1));
    const key = path[path.length - 1];
    if (!parent.getChild(key).runtime) return;

    parent.removeChild(key);
  }
}

function update(path, targetModule, newModule) {
  if (process.env.NODE_ENV !== "production") {
    assertRawModule(path, newModule);
  }

  // update target module
  targetModule.update(newModule);

  // update nested modules
  if (newModule.modules) {
    for (const key in newModule.modules) {
      if (!targetModule.getChild(key)) {
        if (process.env.NODE_ENV !== "production") {
          console.warn(
            `[vuex] trying to add a new module '${key}' on hot reloading, ` +
              "manual reload is needed"
          );
        }
        return;
      }
      update(
        path.concat(key),
        targetModule.getChild(key),
        newModule.modules[key]
      );
    }
  }
}

const functionAssert = {
  assert: value => typeof value === "function",
  expected: "function"
};

const objectAssert = {
  assert: value =>
    typeof value === "function" ||
    (typeof value === "object" && typeof value.handler === "function"),
  expected: 'function or object with "handler" function'
};

const assertTypes = {
  getters: functionAssert,
  mutations: functionAssert,
  actions: objectAssert
};

function assertRawModule(path, rawModule) {
  Object.keys(assertTypes).forEach(key => {
    if (!rawModule[key]) return;

    const assertOptions = assertTypes[key];

    forEachValue(rawModule[key], (value, type) => {
      assert(
        assertOptions.assert(value),
        makeAssertionMessage(path, key, type, value, assertOptions.expected)
      );
    });
  });
}

function makeAssertionMessage(path, key, type, value, expected) {
  let buf = `${key} should be ${expected} but "${key}.${type}"`;
  if (path.length > 0) {
    buf += ` in module "${path.join(".")}"`;
  }
  buf += ` is ${JSON.stringify(value)}.`;
  return buf;
}
