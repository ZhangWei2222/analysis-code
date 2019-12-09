# Vuex.Store 构造函数

1. 判断是否自动安装vue

2. 初始化内部变量，将dispatch与commit调用的this绑定为store对象本身，否则在组件内部this.dispatch时的this会指向组件的vm

3. 是否严格模式

4. 执行installModule（初始化module）

5. 执行resetStoreVM（通过VM使store“响应式”）

6. 调用插件、devtool

```js
export class Store {
  constructor(options = {}) {
    // 判断window.vue是否存在，如果不存在那么就安装
    if (!Vue && typeof window !== "undefined" && window.Vue) {
      install(window.Vue);
    }

    // 开发过程的判断：创建store实例之前必须先使用这个方法Vue.use(Vuex)，并且判断promise是否可用
    if (process.env.NODE_ENV !== "production") {
      // 必须使用 Vue.use(Vuex) 创建 store 实例
      assert(Vue, `must call Vue.use(Vuex) before creating a store instance.`);
      // 因为vuex中使用了Promise，Promise是es6的语法，但是有的浏览器并不支持es6所以我们需要在package.json中加入babel-polyfill用来支持es6
      assert(
        typeof Promise !== "undefined",
        `vuex requires a Promise polyfill in this browser.`
      );
      // Store 函数必须使用 new 操作符调用
      assert(
        this instanceof Store,
        `store must be called with the new operator.`
      );
    }

    // 提取参数
    const {
      /* 插件默认是空数组，包含应用在 store 上的插件方法。这些插件直接接收 store 作为唯一参数，可以监听 mutation（用于外部地数据持久化、记录或调试）或者提交 mutation （用于内部数据，例如 websocket 或 某些观察者）*/
      plugins = [],
      /* 默认是false，使 Vuex store 进入严格模式，在严格模式下，任何 mutation 处理函数以外修改 Vuex state 都会抛出错误。*/
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

    /* 将dispatch与commit调用的this绑定为store对象本身，否则在组件内部this.dispatch时的this会指向组件的vm */
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
}
```



## class ModuleCollection

上面有句`this._modules = new ModuleCollection(options);`

**作用：**收集模块，构造模块树结构

```js
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
```

### class Module  

接下来看看Module的实例

```js
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
}
```



## installModule 函数

1. 为module加上namespace名字空间（如果有）
2. 注册mutation、action以及getter，同时递归安装所有子module。

```js
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

  // 注册state
  // 如果不是根并且不是热重载的情况
  if (!isRoot && !hot) {
    /* 获取父级的state */
    const parentState = getNestedState(rootState, path.slice(0, -1));
    // 模块名称
    const moduleName = path[path.length - 1];

    // state 注册
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

  /**
   * module.context 这个赋值主要是给 helpers 中 mapState、mapGetters、mapMutations、mapActions四个辅助函数使用的。
   * 生成本地的dispatch、commit、getters和state。
   * 主要作用就是抹平差异化，不需要用户再传模块参数。
   */
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
    installModule(store, rootState, path.concat(key), child, hot);
  });
}
```



## resetStoreVM 函数

1. 遍历wrappedGetters，使用Object.defineProperty方法为每一个getter绑定上get方法，这样我们就可以在组件里访问this.$store.getter.test就等同于访问store._vm.test

2. 然后new一个Vue对象来实现数据的“响应式化”，运用Vue.js内部提供的数据双向绑定功能来实现store的数据与视图的同步更新

```js
/* 通过vm重设store，新建Vue对象使用Vue内部的响应式实现注册state以及computed */
function resetStoreVM(store, state, hot) {
  /* 存放之前的vm对象 */
  const oldVm = store._vm;

  // 绑定 store.getter
  store.getters = {};
  // 重置 本地getters的缓存
  store._makeLocalGettersCache = Object.create(null);
  // 注册时收集的处理后的用户自定义的 wrappedGetters
  const wrappedGetters = store._wrappedGetters;
  // 声明 计算属性 computed 对象
  const computed = {};

  /* 通过Object.defineProperty为每一个getter方法设置get方法，比如获取this.$store.getters.test的时候获取的是store._vm.test，也就是Vue对象的computed属性 */
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

  // 使用一个 Vue 实例对象存储 state 树
  // 阻止警告 用户添加的一些全局mixins
  // 声明变量 silent 存储用户设置的静默模式配置
  const silent = Vue.config.silent;
  /* Vue.config.silent暂时设置为true的目的是在new一个Vue实例的过程中不会报出一切警告 */
  Vue.config.silent = true;
  /*  这里new了一个Vue对象，运用Vue内部的响应式实现注册state以及computed */
  store._vm = new Vue({
    data: {
      $$state: state
    },
    computed
  });
  Vue.config.silent = silent;

  /* 使能严格模式，保证修改store只能通过mutation */
  if (store.strict) {
    enableStrictMode(store);
  }

  if (oldVm) {
    /* 解除旧vm的state的引用，以及销毁旧的Vue对象 */
    if (hot) {
      // 热加载为 true
      // 设置  oldVm._data.$$state = null
      store._withCommit(() => {
        oldVm._data.$$state = null;
      });
    }
    // 实例销毁
    Vue.nextTick(() => oldVm.$destroy());
  }
}
```


