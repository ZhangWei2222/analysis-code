import applyMixin from "./mixin";
import devtoolPlugin from "./plugins/devtool";
import ModuleCollection from "./module/module-collection";
import { forEachValue, isObject, isPromise, assert, partial } from "./util";

let Vue; // 绑定安装

export class Store {
  constructor(options = {}) {
    // 判断window.vue是否存在，如果不存在那么就安装
    if (!Vue && typeof window !== "undefined" && window.Vue) {
      install(window.Vue);
    }

    // 开发过程的判断：创建store实例之前必须先使用这个方法Vue.use(Vuex)，并且判断promise是否可用
    if (process.env.NODE_ENV !== "production") {
      assert(Vue, `must call Vue.use(Vuex) before creating a store instance.`);
      // 因为vuex中使用了Promise，Promise是es6的语法，但是有的浏览器并不支持es6所以我们需要在package.json中加入babel-polyfill用来支持es6
      assert(
        typeof Promise !== "undefined",
        `vuex requires a Promise polyfill in this browser.`
      );
      assert(
        this instanceof Store,
        `store must be called with the new operator.`
      );
    }

    // 提取参数
    const {
      /*一个数组，包含应用在 store 上的插件方法。这些插件直接接收 store 作为唯一参数，可以监听 mutation（用于外部地数据持久化、记录或调试）或者提交 mutation （用于内部数据，例如 websocket 或 某些观察者）*/
      plugins = [],
      /*使 Vuex store 进入严格模式，在严格模式下，任何 mutation 处理函数以外修改 Vuex state 都会抛出错误。*/
      strict = false
    } = options;

    // 初始化store内部状态
    /* 用来判断严格模式下是否是用mutation修改state的 */
    this._committing = false;
    /* 存放action */
    this._actions = Object.create(null);
    // 用来存储所有对 action 变化的订阅者
    this._actionSubscribers = [];
    /* 存放mutation */
    this._mutations = Object.create(null);
    /* 存放getter */
    this._wrappedGetters = Object.create(null);
    // 模块收集器，构造模块树形结构
    this._modules = new ModuleCollection(options);
    /* 根据namespace存放module */
    this._modulesNamespaceMap = Object.create(null);
    // 用来存储所有对 mutation 变化的订阅者
    this._subscribers = [];
    // 用于使用 $watch 观测 getters
    this._watcherVM = new Vue();
    // 用来存放生成的本地 getters 的缓存
    this._makeLocalGettersCache = Object.create(null);

    /*将dispatch与commit调用的this绑定为store对象本身，否则在组件内部this.dispatch时的this会指向组件的vm*/
    const store = this;
    const { dispatch, commit } = this;
    /* 为dispatch与commit绑定this（Store实例本身） */
    this.dispatch = function boundDispatch(type, payload) {
      return dispatch.call(store, type, payload);
    };
    this.commit = function boundCommit(type, payload, options) {
      return commit.call(store, type, payload, options);
    };

    // 严格模式
    this.strict = strict;

    const state = this._modules.root.state;
    this._wrappedGetters;

    // 初始化根模块，递归注册所有的子模块，收集所有module的getter到_wrappedGetters中去，this._modules.root代表根module才独有保存的Module对象
    installModule(this, state, [], this._modules.root);

    // initialize the store vm, which is responsiblproperties)
    // 通过vm重设store，新建Vue对象使用Vue内部的响应式实现注册state以及computed
    resetStoreVM(this, state);

    // apply plugins
    // 执行每个插件里边的函数
    plugins.forEach(plugin => plugin(this));

    /* devtool插件 */
    const useDevtools =
      options.devtools !== undefined ? options.devtools : Vue.config.devtools;
    if (useDevtools) {
      devtoolPlugin(this);
    }
  }

  get state() {
    return this._vm._data.$$state;
  }

  set state(v) {
    if (process.env.NODE_ENV !== "production") {
      assert(
        false,
        `use store.replaceState() to explicit replace store state.`
      );
    }
  }

  commit(_type, _payload, _options) {
    // check object-style commit
    const { type, payload, options } = unifyObjectStyle(
      _type,
      _payload,
      _options
    );

    const mutation = { type, payload };
    const entry = this._mutations[type];
    if (!entry) {
      if (process.env.NODE_ENV !== "production") {
        console.error(`[vuex] unknown mutation type: ${type}`);
      }
      return;
    }
    this._withCommit(() => {
      entry.forEach(function commitIterator(handler) {
        handler(payload);
      });
    });
    this._subscribers.forEach(sub => sub(mutation, this.state));

    if (process.env.NODE_ENV !== "production" && options && options.silent) {
      console.warn(
        `[vuex] mutation type: ${type}. Silent option has been removed. ` +
          "Use the filter functionality in the vue-devtools"
      );
    }
  }

  dispatch(_type, _payload) {
    console.log(_type, _payload);
    // check object-style dispatch
    const { type, payload } = unifyObjectStyle(_type, _payload);

    const action = { type, payload };
    const entry = this._actions[type];
    if (!entry) {
      if (process.env.NODE_ENV !== "production") {
        console.error(`[vuex] unknown action type: ${type}`);
      }
      return;
    }

    try {
      this._actionSubscribers
        .filter(sub => sub.before)
        .forEach(sub => sub.before(action, this.state));
    } catch (e) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[vuex] error in before action subscribers: `);
        console.error(e);
      }
    }

    const result =
      entry.length > 1
        ? Promise.all(entry.map(handler => handler(payload)))
        : entry[0](payload);

    return result.then(res => {
      try {
        this._actionSubscribers
          .filter(sub => sub.after)
          .forEach(sub => sub.after(action, this.state));
      } catch (e) {
        if (process.env.NODE_ENV !== "production") {
          console.warn(`[vuex] error in after action subscribers: `);
          console.error(e);
        }
      }
      return res;
    });
  }

  subscribe(fn) {
    return genericSubscribe(fn, this._subscribers);
  }

  subscribeAction(fn) {
    const subs = typeof fn === "function" ? { before: fn } : fn;
    return genericSubscribe(subs, this._actionSubscribers);
  }

  watch(getter, cb, options) {
    if (process.env.NODE_ENV !== "production") {
      assert(
        typeof getter === "function",
        `store.watch only accepts a function.`
      );
    }
    return this._watcherVM.$watch(
      () => getter(this.state, this.getters),
      cb,
      options
    );
  }

  replaceState(state) {
    this._withCommit(() => {
      this._vm._data.$$state = state;
    });
  }

  registerModule(path, rawModule, options = {}) {
    if (typeof path === "string") path = [path];

    if (process.env.NODE_ENV !== "production") {
      assert(Array.isArray(path), `module path must be a string or an Array.`);
      assert(
        path.length > 0,
        "cannot register the root module by using registerModule."
      );
    }

    this._modules.register(path, rawModule);
    installModule(
      this,
      this.state,
      path,
      this._modules.get(path),
      options.preserveState
    );
    // reset store to update getters...
    resetStoreVM(this, this.state);
  }

  unregisterModule(path) {
    if (typeof path === "string") path = [path];

    if (process.env.NODE_ENV !== "production") {
      assert(Array.isArray(path), `module path must be a string or an Array.`);
    }

    this._modules.unregister(path);
    this._withCommit(() => {
      const parentState = getNestedState(this.state, path.slice(0, -1));
      Vue.delete(parentState, path[path.length - 1]);
    });
    resetStore(this);
  }

  hotUpdate(newOptions) {
    this._modules.update(newOptions);
    resetStore(this, true);
  }

  _withCommit(fn) {
    const committing = this._committing;
    this._committing = true;
    fn();
    this._committing = committing;
  }
}

function genericSubscribe(fn, subs) {
  if (subs.indexOf(fn) < 0) {
    subs.push(fn);
  }
  return () => {
    const i = subs.indexOf(fn);
    if (i > -1) {
      subs.splice(i, 1);
    }
  };
}

function resetStore(store, hot) {
  store._actions = Object.create(null);
  store._mutations = Object.create(null);
  store._wrappedGetters = Object.create(null);
  store._modulesNamespaceMap = Object.create(null);
  const state = store.state;
  // init all modules
  installModule(store, state, [], store._modules.root, true);
  // reset vm
  resetStoreVM(store, state, hot);
}

function resetStoreVM(store, state, hot) {
  const oldVm = store._vm;

  // bind store public getters
  store.getters = {};
  // reset local getters cache
  store._makeLocalGettersCache = Object.create(null);
  const wrappedGetters = store._wrappedGetters;
  const computed = {};
  forEachValue(wrappedGetters, (fn, key) => {
    // use computed to leverage its lazy-caching mechanism
    // direct inline function use will lead to closure preserving oldVm.
    // using partial to return function with only arguments preserved in closure environment.
    computed[key] = partial(fn, store);
    Object.defineProperty(store.getters, key, {
      get: () => store._vm[key],
      enumerable: true // for local getters
    });
  });

  // use a Vue instance to store the state tree
  // suppress warnings just in case the user has added
  // some funky global mixins
  const silent = Vue.config.silent;
  Vue.config.silent = true;
  store._vm = new Vue({
    data: {
      $$state: state
    },
    computed
  });
  Vue.config.silent = silent;

  // enable strict mode for new vm
  if (store.strict) {
    enableStrictMode(store);
  }

  if (oldVm) {
    if (hot) {
      // dispatch changes in all subscribed watchers
      // to force getter re-evaluation for hot reloading.
      store._withCommit(() => {
        oldVm._data.$$state = null;
      });
    }
    Vue.nextTick(() => oldVm.$destroy());
  }
}

/* 初始化module */
/* @store: 表示当前Store实例
/* @rootState: 表示根state
/* @path: 我们可以将一个store实例看成module的集合。每一个集合也是store的实例。那么path就可以想象成一种层级关系，当你有了rootState和path后，就可以在Path路径中找到local State。然后每次getters或者setters改变的就是localState
/* @module:表示当前安装的模块
/* @hot：当动态改变modules或者热更新的时候为true */
function installModule(store, rootState, path, module, hot) {
  /* 是否是根module */
  const isRoot = !path.length;
  /* 获取module的namespace */
  const namespace = store._modules.getNamespace(path);

  /* 如果有namespace，检查是否重复，不重复则在_modulesNamespaceMap中注册 */
  if (module.namespaced) {
    if (
      store._modulesNamespaceMap[namespace] &&
      process.env.NODE_ENV !== "production"
    ) {
      console.error(
        `[vuex] duplicate namespace ${namespace} for the namespaced module ${path.join(
          "/"
        )}`
      );
    }
    store._modulesNamespaceMap[namespace] = module;
  }

  // 如果如果不是根并且Hot为false的情况
  if (!isRoot && !hot) {
    /* 获取父级的state */
    const parentState = getNestedState(rootState, path.slice(0, -1));
    /* module的name */
    const moduleName = path[path.length - 1];

    store._withCommit(() => {
      if (process.env.NODE_ENV !== "production") {
        // 有相同的模块名会报错
        if (moduleName in parentState) {
          console.warn(
            `[vuex] state field "${moduleName}" was overridden by a module with the same name at "${path.join(
              "."
            )}"`
          );
        }
      }
      /* 将子module设置称响应式的 */
      Vue.set(parentState, moduleName, module.state);
    });
  }

  const local = (module.context = makeLocalContext(store, namespace, path));

  /* 遍历注册mutation */
  module.forEachMutation((mutation, key) => {
    const namespacedType = namespace + key;
    registerMutation(store, namespacedType, mutation, local);
  });

  /* 遍历注册action */
  module.forEachAction((action, key) => {
    const type = action.root ? key : namespace + key;
    const handler = action.handler || action;
    registerAction(store, type, handler, local);
  });

  /* 遍历注册getter */
  module.forEachGetter((getter, key) => {
    const namespacedType = namespace + key;
    registerGetter(store, namespacedType, getter, local);
  });

  /* 递归安装mudule */
  module.forEachChild((child, key) => {
    console.log(child, key);
    installModule(store, rootState, path.concat(key), child, hot);
  });
}

/**
 * make localized dispatch, commit, getters and state
 * if there is no namespace, just use root ones
 */
function makeLocalContext(store, namespace, path) {
  const noNamespace = namespace === "";

  const local = {
    dispatch: noNamespace
      ? store.dispatch
      : (_type, _payload, _options) => {
          const args = unifyObjectStyle(_type, _payload, _options);
          const { payload, options } = args;
          let { type } = args;

          if (!options || !options.root) {
            type = namespace + type;
            if (
              process.env.NODE_ENV !== "production" &&
              !store._actions[type]
            ) {
              console.error(
                `[vuex] unknown local action type: ${args.type}, global type: ${type}`
              );
              return;
            }
          }

          return store.dispatch(type, payload);
        },

    commit: noNamespace
      ? store.commit
      : (_type, _payload, _options) => {
          const args = unifyObjectStyle(_type, _payload, _options);
          const { payload, options } = args;
          let { type } = args;

          if (!options || !options.root) {
            type = namespace + type;
            if (
              process.env.NODE_ENV !== "production" &&
              !store._mutations[type]
            ) {
              console.error(
                `[vuex] unknown local mutation type: ${args.type}, global type: ${type}`
              );
              return;
            }
          }

          store.commit(type, payload, options);
        }
  };

  // getters and state object must be gotten lazily
  // because they will be changed by vm update
  Object.defineProperties(local, {
    getters: {
      get: noNamespace
        ? () => store.getters
        : () => makeLocalGetters(store, namespace)
    },
    state: {
      get: () => getNestedState(store.state, path)
    }
  });

  return local;
}

function makeLocalGetters(store, namespace) {
  if (!store._makeLocalGettersCache[namespace]) {
    const gettersProxy = {};
    const splitPos = namespace.length;
    Object.keys(store.getters).forEach(type => {
      // skip if the target getter is not match this namespace
      if (type.slice(0, splitPos) !== namespace) return;

      // extract local getter type
      const localType = type.slice(splitPos);

      // Add a port to the getters proxy.
      // Define as getter property because
      // we do not want to evaluate the getters in this time.
      Object.defineProperty(gettersProxy, localType, {
        get: () => store.getters[type],
        enumerable: true
      });
    });
    store._makeLocalGettersCache[namespace] = gettersProxy;
  }

  return store._makeLocalGettersCache[namespace];
}

function registerMutation(store, type, handler, local) {
  const entry = store._mutations[type] || (store._mutations[type] = []);
  entry.push(function wrappedMutationHandler(payload) {
    handler.call(store, local.state, payload);
  });
}

function registerAction(store, type, handler, local) {
  const entry = store._actions[type] || (store._actions[type] = []);
  entry.push(function wrappedActionHandler(payload) {
    let res = handler.call(
      store,
      {
        dispatch: local.dispatch,
        commit: local.commit,
        getters: local.getters,
        state: local.state,
        rootGetters: store.getters,
        rootState: store.state
      },
      payload
    );
    if (!isPromise(res)) {
      res = Promise.resolve(res);
    }
    if (store._devtoolHook) {
      return res.catch(err => {
        store._devtoolHook.emit("vuex:error", err);
        throw err;
      });
    } else {
      return res;
    }
  });
}

function registerGetter(store, type, rawGetter, local) {
  if (store._wrappedGetters[type]) {
    if (process.env.NODE_ENV !== "production") {
      console.error(`[vuex] duplicate getter key: ${type}`);
    }
    return;
  }
  store._wrappedGetters[type] = function wrappedGetter(store) {
    return rawGetter(
      local.state, // local state
      local.getters, // local getters
      store.state, // root state
      store.getters // root getters
    );
  };
}

function enableStrictMode(store) {
  store._vm.$watch(
    function() {
      return this._data.$$state;
    },
    () => {
      if (process.env.NODE_ENV !== "production") {
        assert(
          store._committing,
          `do not mutate vuex store state outside mutation handlers.`
        );
      }
    },
    { deep: true, sync: true }
  );
}

function getNestedState(state, path) {
  return path.reduce((state, key) => state[key], state);
}

function unifyObjectStyle(type, payload, options) {
  if (isObject(type) && type.type) {
    options = payload;
    payload = type;
    type = type.type;
  }

  if (process.env.NODE_ENV !== "production") {
    assert(
      typeof type === "string",
      `expects string as the type, but found ${typeof type}.`
    );
  }

  return { type, payload, options };
}

/* 暴露给外部的插件install方法，供Vue.use调用安装插件 */
/* 当window上有Vue对象的时候，就会手动编写install方法，并且传入Vue的使用。*/
export function install(_Vue) {
  if (Vue && _Vue === Vue) {
    /* 避免重复安装（Vue.use内部也会检测一次是否重复安装同一个插件）*/
    if (process.env.NODE_ENV !== "production") {
      console.error(
        "[vuex] already installed. Vue.use(Vuex) should be called only once."
      );
    }
    return;
  }
  /* 保存Vue，同时用于检测是否重复安装 */
  Vue = _Vue;

  /* 将vuexInit混淆进Vue的beforeCreate(Vue2.0)或_init方法(Vue1.0) */
  /* vueInit 是对vuex的初始化，把$store属性添加到vue实例上，所以我们平常写代码可以使用this.$store，这里的store就是我们实例化Vue的时候传进去的store */
  applyMixin(Vue);
}
