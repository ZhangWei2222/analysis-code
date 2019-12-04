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

5. 执行 resetStoreVM（通过 VM 使 store“响应式”）

6. 调用插件、devtool

## installModule

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
    installModule(store, rootState, path.concat(key), child, hot);
  });
}
```

**作用：**

1. 为 module 加上 namespace 名字空间（如果有）
2. 注册 mutation、action 以及 getter，同时递归安装所有子 module。

## resetStoreVM

```js
/* 通过vm重设store，新建Vue对象使用Vue内部的响应式实现注册state以及computed */
function resetStoreVM(store, state, hot) {
  /* 存放之前的vm对象 */
  const oldVm = store._vm;

  // bind store public getters
  store.getters = {};
  // reset local getters cache
  store._makeLocalGettersCache = Object.create(null);
  const wrappedGetters = store._wrappedGetters;
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

  // use a Vue instance to store the state tree
  // suppress warnings just in case the user has added
  // some funky global mixins
  const silent = Vue.config.silent;
  /* Vue.config.silent暂时设置为true的目的是在new一个Vue实例的过程中不会报出一切警告 */
  Vue.config.silent = true;
  /*  这里new了一个Vue对象，运用Vue内部的响应式实现注册state以及computed*/
  store._vm = new Vue({
    data: {
      $$state: state
    },
    computed
  });
  Vue.config.silent = silent;

  // enable strict mode for new vm
  /* 使能严格模式，保证修改store只能通过mutation */
  if (store.strict) {
    enableStrictMode(store);
  }

  if (oldVm) {
    /* 解除旧vm的state的引用，以及销毁旧的Vue对象 */
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
```

**作用：**

1. 遍历 wrappedGetters，使用 Object.defineProperty 方法为每一个 getter 绑定上 get 方法，这样我们就可以在组件里访问 this.\$store.getter.test 就等同于访问 store.\_vm.test

2. 然后 new 一个 Vue 对象来实现数据的“响应式化”，运用 Vue.js 内部提供的数据双向绑定功能来实现 store 的数据与视图的同步更新

## 严格模式

```js
const store = new Vuex.Store({
  strict: true
)}
```

在`Store`类的 option 中设置`strict`参数为 true，严格模式下，所有修改 state 的操作必须通过 mutation 实现，否则会抛出错误。

```js
/* 使用严格模式 */
function enableStrictMode(store) {
  console.log(store._committing);
  store._vm.$watch(
    function() {
      return this._data.$$state;
    },
    () => {
      if (process.env.NODE_ENV !== "production") {
        /* 检测store中的_committing的值，如果是false代表不是通过mutation的方法修改的 */
        assert(
          store._committing,
          `do not mutate vuex store state outside mutation handlers.`
        );
      }
    },
    { deep: true, sync: true }
  );
}
```

**作用：**利用 vm 去 watch state，在被修改时进入回调；通过 assert 断言检测 store.\_committing，如果为 false，触发断言，抛出异常

在 Store 构造类的 commit 方法内，执行 mutation 的语句是这样的

```js
this._withCommit(() => {
  entry.forEach(function commitIterator(handler) {
    handler(payload);
  });
});
```

### \_withCommit

```js
/* 调用withCommit修改state的值时会将store的committing值置为true，内部会有断言检查该值，在严格模式下只允许使用mutation来修改store中的值，而不允许直接修改store的数值 */
_withCommit(fn) {
  const committing = this._committing;
  this._committing = true;
  fn();
  this._committing = committing;
}
```

store.\_committing 默认为 false，这里控制执行 mutation 修改 state 时，会变成 true，所以严格模式下就不会报错。如果不是在 mutation 修改，store.\_committing 就还是 false，抛出异常

## commit(mutation)

```js
/* 调用mutation的commit方法 */
commit(_type, _payload, _options) {
  // 校验参数
  const { type, payload, options } = unifyObjectStyle(
    _type,
    _payload,
    _options
  );

  const mutation = { type, payload };
  /* 取出type对应的mutation的方法 */
  const entry = this._mutations[type];
  debugger;
  if (!entry) {
    if (process.env.NODE_ENV !== "production") {
      console.error(`[vuex] unknown mutation type: ${type}`);
    }
    return;
  }
  /* 执行mutation中的所有方法 */
  this._withCommit(() => {
    entry.forEach(function commitIterator(handler) {
      handler(payload);
    });
  });
  /* 通知所有订阅者 */
  this._subscribers.forEach(sub => sub(mutation, this.state));

  if (process.env.NODE_ENV !== "production" && options && options.silent) {
    console.warn(
      `[vuex] mutation type: ${type}. Silent option has been removed. ` +
      "Use the filter functionality in the vue-devtools"
    );
  }
}
```

**作用：**

1. 根据 type 找到并调用\_mutations 中的所有 type 对应的 mutation 方法，所以当没有 namespace 的时候，commit 方法会触发所有 module 中的 mutation 方法
2. 执行完所有的 mutation 之后会执行\_subscribers 中的所有订阅者

### subscribers

```js
/* 注册一个订阅函数，返回取消订阅的函数 */
subscribe(fn) {
  return genericSubscribe(fn, this._subscribers);
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
```

**作用：**

Store 给外部提供了一个 subscribe 方法，用以注册一个订阅函数，会 push 到 Store 实例的\_subscribers 中，同时返回一个从\_subscribers 中注销该订阅者的方法。

在 commit 结束以后则会调用这些\_subscribers 中的订阅者，这个订阅者模式提供给外部一个监视 state 变化的可能。state 通过 mutation 改变时，可以有效捕获这些变化。

## dispatch(action)

```js
/* 调用action的dispatch方法 */
dispatch(_type, _payload) {
  // 校验参数
  const { type, payload } = unifyObjectStyle(_type, _payload);

  const action = { type, payload };

  /* actions中取出type对应的ation */
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

  /* 是数组则包装Promise形成一个新的Promise，只有一个则直接返回第0个 */
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
```

### registerAction

```js
/* 遍历注册action */
function registerAction(store, type, handler, local) {
  /* 取出type对应的action */
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
    /* 判断是否是Promise */
    if (!isPromise(res)) {
      /* 不是Promise对象的时候转化称Promise对象 */
      res = Promise.resolve(res);
    }
    if (store._devtoolHook) {
      /* 存在devtool插件的时候，如果有错误触发vuex的error给devtool */
      return res.catch(err => {
        store._devtoolHook.emit("vuex:error", err);
        throw err;
      });
    } else {
      return res;
    }
  });
}
```

**作用：**

1. 将 push 进\_actions 的 action 进行一层封装（wrappedActionHandler），

2. 然后判断封装好的 res 是否是一个 Promise，不是则转化为 Promise 对象

3. dispatch 时则从\_actions 中取出，只有一个的时候直接返回，否则用 Promise.all 处理

## registerModule

我们可以在页面动态注册模块，像如下：

```js
this.$store.registerModule("c", {
  state: { count: 3 }
});
```

以下是实现过程：

```js
/* 注册一个动态module，当业务进行异步加载的时候，可以通过该接口进行注册动态module */
registerModule(path, rawModule, options = {}) {
  /* 转化称Array */
  if (typeof path === "string") path = [path];

  if (process.env.NODE_ENV !== "production") {
    assert(Array.isArray(path), `module path must be a string or an Array.`);
    assert(
      path.length > 0,
      "cannot register the root module by using registerModule."
    );
  }

  /* 注册 */
  this._modules.register(path, rawModule);
  /* 初始化module */
  installModule(
    this,
    this.state,
    path,
    this._modules.get(path),
    options.preserveState
  );
  /* 通过vm重设store，新建Vue对象使用Vue内部的响应式实现注册state以及computed */
  resetStoreVM(this, this.state);
}
```

**作用：**重点还是 installModule 与 resetStoreVM

## unregisterModule

动态注销模块

```js
this.$store.unregisterModule("c");
```

实现方法是先从 state 中删除对应模块，然后用 resetStore 来重制 store

```js
/* 注销一个动态module */
unregisterModule(path) {
  /* 转化称Array */
  if (typeof path === "string") path = [path];

  if (process.env.NODE_ENV !== "production") {
    assert(Array.isArray(path), `module path must be a string or an Array.`);
  }

  /* 注销 */
  this._modules.unregister(path);
  this._withCommit(() => {
    /* 获取父级的state */
    const parentState = getNestedState(this.state, path.slice(0, -1));
    /* 从父级中删除 */
    Vue.delete(parentState, path[path.length - 1]);
  });
  /* 重制store */
  resetStore(this);
}
```

## resetStore

将 store 中的\_actions 等进行初始化以后，重新执行 installModule 与 resetStoreVM 来初始化 module 以及用 Vue 特性使其“响应式化”，这跟构造函数中的是一致的

```js
/* 重制store */
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
```

## watch

vuex 提供了一个 watch 实例方法，使用：`this.$store.watch()`

```js
/* 观察一个getter方法 */
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
```

关键是\_watcherVM，它一个 Vue 的实例，所以 watch 就可以直接采用了 Vue 内部的 watch 特性提供了一种观察数据 getter 变动的方法

## 插件

```js
/* 从window对象的__VUE_DEVTOOLS_GLOBAL_HOOK__中获取devtool插件 */
const target =
  typeof window !== "undefined"
    ? window
    : typeof global !== "undefined"
    ? global
    : {};
const devtoolHook = target.__VUE_DEVTOOLS_GLOBAL_HOOK__;

export default function devtoolPlugin(store) {
  if (!devtoolHook) return;

  /* devtoll插件实例存储在store的_devtoolHook上 */
  store._devtoolHook = devtoolHook;

  /* 出发vuex的初始化事件，并将store的引用地址传给deltool插件，使插件获取store的实例 */
  devtoolHook.emit("vuex:init", store);

  /* 监听travel-to-state事件 */
  devtoolHook.on("vuex:travel-to-state", targetState => {
    /* 重制state */
    store.replaceState(targetState);
  });

  /* 订阅store的变化 */
  store.subscribe((mutation, state) => {
    devtoolHook.emit("vuex:mutation", mutation, state);
  });
}
```

如果安装了 devtool 插件，会在 windows 对象上暴露一个**VUE_DEVTOOLS_GLOBAL_HOOK**，可以用`window.__VUE_DEVTOOLS_GLOBAL_HOOK__`打印出来。

vuex 在初始化的时候，会触发“vuex:init”事件通知插件，然后通过 on 方法监听“vuex:travel-to-state”事件来重置 state。最后通过 Store 的 subscribe 方法来添加一个订阅者，在触发 commit 方法修改 mutation 数据以后，该订阅者会被通知，从而触发“vuex:mutation”事件。
