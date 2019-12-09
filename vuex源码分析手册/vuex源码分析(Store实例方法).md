# Vuex.Store 实例方法

[Vuex Api 文档]: https://vuex.vuejs.org/zh/api/



## commit(mutation)


1. 根据type找到并调用_mutations中的所有type对应的mutation方法，所以当没有namespace的时候，commit方法会触发所有module中的mutation方法
2. 执行完所有的mutation之后会执行_subscribers中的所有订阅者

```js
/* 调用mutation的commit方法 */
commit(_type, _payload, _options) {
  // 校验参数
  // 统一成对象风格
  const { type, payload, options } = unifyObjectStyle(
    _type,
    _payload,
    _options
  );

  const mutation = { type, payload };
  /* 取出type对应的mutation的方法 */
  const entry = this._mutations[type];
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

### subscribers

Store给外部提供了一个subscribe方法，用以注册一个订阅函数，会push到Store实例的_subscribers中，同时返回一个从_subscribers中注销该订阅者的方法。

在commit结束以后则会调用这些_subscribers中的订阅者，这个订阅者模式提供给外部一个监视state变化的可能。state通过mutation改变时，可以有效捕获这些变化。

```js
// 订阅 store 的 mutation
subscribe(fn) {
  return genericSubscribe(fn, this._subscribers);
}
/* 收集订阅者:注册一个订阅函数，返回取消订阅的函数 */
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

### unifyObjectStyle

`unifyObjectStyle`函数将参数统一，返回 `{ type, payload, options }`。

```js
// 统一成对象风格
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
```

`commit` 支持多种方式。比如：

```js
store.commit('increment', {
  count: 10
})
// 对象提交方式
store.commit({
  type: 'increment',
  count: 10
})
```



## dispatch(action)

```js
/* 调用action的dispatch方法 */
dispatch(_type, _payload) {
  // 获取到type和payload参数
  const { type, payload } = unifyObjectStyle(_type, _payload);

  // 声明 action 变量 等于 type和payload参数
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



## registerAction

1. 将push进_actions的action进行一层封装（wrappedActionHandler），

2. 然后判断封装好的res是否是一个Promise，不是则转化为Promise对象

3. dispatch时则从_actions中取出，只有一个的时候直接返回，否则用Promise.all处理

```js
/**
 * 注册 mutation
 * @param {Object} store 对象
 * @param {String} type 类型
 * @param {Function} handler 用户自定义的函数
 * @param {Object} local local 对象
 */
function registerAction(store, type, handler, local) {
  /* 取出type对应的action */
  const entry = store._actions[type] || (store._actions[type] = []);
  // payload 是actions函数的第二个参数
  entry.push(function wrappedActionHandler(payload) {
    /**
     * 也就是为什么用户定义的actions中的函数第一个参数有
     *  { dispatch, commit, getters, state, rootGetters, rootState } 的原因
     * actions: {
     *    checkout ({ commit, state }, products) {
     *        console.log(commit, state);
     *    }
     * }
     */
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
    /**
     * export function isPromise (val) {
        return val && typeof val.then === 'function'
      }
     * 判断如果不是Promise Promise 化，也就是为啥 actions 中处理异步函数
        也就是为什么构造函数中断言不支持promise报错的原因
        vuex需要Promise polyfill
        assert(typeof Promise !== 'undefined', `vuex requires a Promise polyfill in this browser.`)
     */
    if (!isPromise(res)) {
      /* 不是Promise对象的时候转化称Promise对象 */
      res = Promise.resolve(res);
    }
    // devtool 工具触发 vuex:error
    if (store._devtoolHook) {
      // catch 捕获错误
      return res.catch(err => {
        store._devtoolHook.emit("vuex:error", err);
        // 抛出错误
        throw err;
      });
    } else {
      // 然后函数执行结果
      return res;
    }
  });
}
```




## registerModule

我们可以在页面动态注册模块，像如下：

```js
this.$store.registerModule("c", {
  state: { count: 3 }
});
```

以下是实现过程：

```js
/**
   * 注册一个动态module，当业务进行异步加载的时候，可以通过该接口进行注册动态module
   * @param {Array|String} path 路径
   * @param {Object} rawModule 原始未加工的模块
   * @param {Object} options 参数选项
   */
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

  // 手动调用 模块注册的方法
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

重点还是installModule与resetStoreVM



## unregisterModule

动态注销模块

```js
this.$store.unregisterModule("c");
```

实现方法是先从state中删除对应模块，然后用resetStore来重制store

```js
/**
   * 注销模块
   * @param {Array|String} path 路径
   */
unregisterModule(path) {
  /* 转化称Array */
  if (typeof path === "string") path = [path];

  if (process.env.NODE_ENV !== "production") {
    assert(Array.isArray(path), `module path must be a string or an Array.`);
  }

  // 手动调用模块注销
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

将store中的_actions等进行初始化以后，重新执行installModule与resetStoreVM来初始化module以及用Vue特性使其“响应式化”，这跟构造函数中的是一致的

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

vuex提供了一个watch实例方法，使用：`this.$store.watch()`

```js
/**
   * 观测某个值
   * @param {Function} getter 函数
   * @param {Function} cb 回调
   * @param {Object} options 参数对象
   */
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

关键是_watcherVM，它一个Vue的实例，所以watch就可以直接采用了Vue内部的watch特性提供了一种观察数据getter变动的方法



## hotUpdate

热替换新的 `action` 和 `mutation`

```js
// 热加载
hotUpdate (newOptions) {
  // 调用的是 ModuleCollection 的 update 方法，最终调用对应的是每个 Module 的 update
  this._modules.update(newOptions)
  // 重置 Store
  resetStore(this, true)
}
```

