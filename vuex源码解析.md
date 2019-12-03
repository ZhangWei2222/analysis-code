## 安装

```js
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
```

**install 代码的作用：**

1. 防止 Vuex 被重复安装
2. 执行 applyMixin，目的是执行 vuexInit 方法初始化 Vuex
   - 如果是 Vue1.0，Vuex 会将`vuexInit`方法放入 Vue 的`_init`方法中
   - 如果是 Vue2.0，则会将`vuexinit`混淆进 Vue 的`beforeCreacte`钩子中

```js
export default function(Vue) {
  // 判断VUe的版本
  const version = Number(Vue.version.split(".")[0]);

  // 如果vue的版本大于2，那么beforeCreate钩子 对vuex进行初始化
  if (version >= 2) {
    Vue.mixin({ beforeCreate: vuexInit });
  } else {
    // 兼容vue 1的版本，将vuexInit方法放入Vue的_init方法中
    const _init = Vue.prototype._init;
    Vue.prototype._init = function(options = {}) {
      options.init = options.init ? [vuexInit].concat(options.init) : vuexInit;
      _init.call(this, options);
    };
  }

  /**
   * Vuex的init钩子，会存入每一个Vue实例等钩子列表
   */
  // 给vue的实例注册一个$store的属性，类似咱们使用vue.$route
  function vuexInit() {
    const options = this.$options;
    // store injection
    if (options.store) {
      /* 存在store其实代表的就是Root节点，直接执行store（function时）或者使用store（非function）*/
      this.$store =
        typeof options.store === "function" ? options.store() : options.store;
    } else if (options.parent && options.parent.$store) {
      /* 子组件直接从父组件中获取$store，这样就保证了所有组件都公用了全局的同一份store */
      this.$store = options.parent.$store;
    }
  }
}
```

**作用：**在 vue 的声明周期中进行 vuex 的初始化，并且对 vue 的各种版本进行了兼容。vuexInit 就是对 vuex 的初始化。
**为什么我们能在使用 vue.$store这种方法呢，因为在vuexInit中为vue的实例添加了$store 属性**

这里的 store 就是 Vuex.Store，我们通常在 store/index.js 里面声明的：

```js
const store = new Vuex.Store({
  state: {
    count: 1
  }
)}
```

## Store

构造函数

```js
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
```

**作用：**

1. 判断是否自动安装 vue

2. 初始化内部变量，将 dispatch 与 commit 调用的 this 绑定为 store 对象本身，否则在组件内部 this.dispatch 时的 this 会指向组件的 vm

3. 是否严格模式

4. 执行 installModule（初始化 module）

5. 执行 setStoreVM（通过 VM 使 store“响应式”）

6. 调用插件、devtool
