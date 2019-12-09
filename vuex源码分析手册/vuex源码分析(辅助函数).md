# 辅助函数

`vuex/src/helper.js`

## mapState

为组件创建计算属性以返回 Vuex store 中的状态

```js
/**
 * @param {String} [namespace] - Module's namespace
 * @param {Object|Array} states # Object's item can be a function which accept state and getters for param, you can do something for state and getters in it.
 * @param {Object}
 */
export const mapState = normalizeNamespace((namespace, states) => {
  const res = {};
  // 非生产环境 判断参数 states  必须是数组或者是对象
  if (process.env.NODE_ENV !== "production" && !isValidMap(states)) {
    console.error(
      "[vuex] mapState: mapper parameter must be either an Array or an Object"
    );
  }
  normalizeMap(states).forEach(({ key, val }) => {
    res[key] = function mappedState() {
      let state = this.$store.state;
      let getters = this.$store.getters;
      // 传了参数 namespace
      if (namespace) {
        // 用 namespace 从 store 中找一个模块
        const module = getModuleByNamespace(this.$store, "mapState", namespace);
        if (!module) {
          return;
        }
        state = module.context.state;
        getters = module.context.getters;
      }
      return typeof val === "function"
        ? val.call(this, state, getters)
        : state[val];
    };
    // 标记为 vuex 方便在 devtools 显示
    res[key].vuex = true;
  });
  return res;
});
```

### normalizeNamespace 函数

标准化统一命名空间

```js
/**
 * @param {Function} fn
 * @return {Function}
 */
function normalizeNamespace(fn) {
  return (namespace, map) => {
    // 命名空间没传，交换参数，namespace 为空字符串
    if (typeof namespace !== "string") {
      map = namespace;
      namespace = "";
    } else if (namespace.charAt(namespace.length - 1) !== "/") {
      // 如果是字符串，最后一个字符不是 / 添加 /
      // 因为 _modulesNamespaceMap 存储的是这样的结构。
      /**
       * _modulesNamespaceMap:
          cart/: {}
          products/: {}
        }
       * */
      namespace += "/";
    }
    return fn(namespace, map);
  };
}
```

### isValidMap 函数

```js
/**
 * @param {*} map
 * @return {Boolean}
 */
function isValidMap(map) {
  return Array.isArray(map) || isObject(map);
}

```

### normalizeMap 函数

标准化统一 map，最终返回的是数组

```js
/**
 * normalizeMap([1, 2, 3]) => [ { key: 1, val: 1 }, { key: 2, val: 2 }, { key: 3, val: 3 } ]
 * normalizeMap({a: 1, b: 2, c: 3}) => [ { key: 'a', val: 1 }, { key: 'b', val: 2 }, { key: 'c', val: 3 } ]
 * @param {Array|Object} map
 * @return {Object}
 */
function normalizeMap(map) {
  if (!isValidMap(map)) {
    return [];
  }
  return Array.isArray(map)
    ? map.map(key => ({ key, val: key }))
    : Object.keys(map).map(key => ({ key, val: map[key] }));
}
```

### getModuleByNamespace 函数

```js
/**
 * Search a special module from store by namespace. if module not exist, print error message.
 * @param {Object} store
 * @param {String} helper
 * @param {String} namespace
 * @return {Object}
 */
function getModuleByNamespace(store, helper, namespace) {
  // _modulesNamespaceMap 这个变量在 class Store installModule 函数中赋值的
  const module = store._modulesNamespaceMap[namespace];
  if (process.env.NODE_ENV !== "production" && !module) {
    console.error(
      `[vuex] module namespace not found in ${helper}(): ${namespace}`
    );
  }
  return module;
}

```

### 例子

```js
computed: {
  ...mapState("a", { count: state => state.count }),
},
// 转化成
computed: {
  count: this.$store._modulesNamespaceMap.['a/'].context.count
},
  
computed: {
  ...mapState(['a']),
},
// 转化成
computed: {
  count: this.$store.state.count
},
```



## mapGetters

为组件创建计算属性以返回 getter 的返回值

```js
/**
 * @param {String} [namespace] - Module's namespace
 * @param {Object|Array} getters
 * @return {Object}
 */
export const mapGetters = normalizeNamespace((namespace, getters) => {
  const res = {};
  // 省略代码：非生产环境 判断参数 getters 必须是数组或者是对象
  if (process.env.NODE_ENV !== "production" && !isValidMap(getters)) {
    console.error(
      "[vuex] mapGetters: mapper parameter must be either an Array or an Object"
    );
  }
  normalizeMap(getters).forEach(({ key, val }) => {
    // The namespace has been mutated by normalizeNamespace
    val = namespace + val;
    res[key] = function mappedGetter() {
      if (
        namespace &&
        !getModuleByNamespace(this.$store, "mapGetters", namespace)
      ) {
        return;
      }
      // 省略代码：匹配不到 getter
      if (
        process.env.NODE_ENV !== "production" &&
        !(val in this.$store.getters)
      ) {
        console.error(`[vuex] unknown getter: ${val}`);
        return;
      }

      return this.$store.getters[val];
    };
    // 标记为 vuex 方便在 devtools 显示
    res[key].vuex = true;
  });
  return res;
});
```

### 举例

```js
computed: {
  ...mapGetters('cart', {
    products: 'cartProducts',
    total: 'cartTotalPrice'
  })
},
// 转换成：
computed: {
  products: this.$store.getters['cart/cartProducts'],
  total: this.$store.getters['cart/cartTotalPrice'],
}
```



## mapActions

创建组件方法分发 action

```js
/**
 * @param {String} [namespace] - Module's namespace
 * @param {Object|Array} mutations # Object's item can be a function which accept `commit` function as the first param, it can accept anthor params. You can commit mutation and do any other things in this function. specially, You need to pass anthor params from the mapped function.
 * @return {Object}
 */
export const mapMutations = normalizeNamespace((namespace, mutations) => {
  const res = {};
  // 省略代码： 非生产环境 判断参数 actions  必须是数组或者是对象
  if (process.env.NODE_ENV !== "production" && !isValidMap(mutations)) {
    console.error(
      "[vuex] mapMutations: mapper parameter must be either an Array or an Object"
    );
  }
  normalizeMap(mutations).forEach(({ key, val }) => {
    res[key] = function mappedMutation(...args) {
      // Get the commit method from store
      let commit = this.$store.commit;
      if (namespace) {
        const module = getModuleByNamespace(
          this.$store,
          "mapMutations",
          namespace
        );
        if (!module) {
          return;
        }
        commit = module.context.commit;
      }
      return typeof val === "function"
        ? val.apply(this, [commit].concat(args))
        : commit.apply(this.$store, [val].concat(args));
    };
  });
  return res;
});
```

### 举例

```js
{
  methods: {
    ...mapMutations(['inc']),
    ...mapMutations('ruochuan', ['dec']),
  }
}
// 转换成
{
  methods: {
    inc(...args){
      return this.$store.dispatch.apply(this.$store, ['inc'].concat(args))
    },
    dec(...args){
      return this.$store._modulesNamespaceMap.['ruochuan/'].context.dispatch.apply(this.$store, ['dec'].concat(args))
    }
  }
}
```



## mapMutations

创建组件方法提交 mutation

```js
/**
 * @param {String} [namespace] - Module's namespace
 * @param {Object|Array} actions # Object's item can be a function which accept `dispatch` function as the first param, it can accept anthor params. You can dispatch action and do any other things in this function. specially, You need to pass anthor params from the mapped function.
 * @return {Object}
 */
export const mapActions = normalizeNamespace((namespace, actions) => {
  const res = {};
  if (process.env.NODE_ENV !== "production" && !isValidMap(actions)) {
    console.error(
      "[vuex] mapActions: mapper parameter must be either an Array or an Object"
    );
  }
  normalizeMap(actions).forEach(({ key, val }) => {
    res[key] = function mappedAction(...args) {
      // get dispatch function from store
      let dispatch = this.$store.dispatch;
      if (namespace) {
        const module = getModuleByNamespace(
          this.$store,
          "mapActions",
          namespace
        );
        if (!module) {
          return;
        }
        dispatch = module.context.dispatch;
      }
      return typeof val === "function"
        ? val.apply(this, [dispatch].concat(args))
        : dispatch.apply(this.$store, [val].concat(args));
    };
  });
  return res;
});
```

### 举例

```js
{
  methods: {
    ...mapActions(['actionA'])
    ...mapActions('ruochuan', ['actionB'])
  }
}
// 转换成
{
  methods: {
    actionA(...args){
      return this.$store.commit.apply(this.$store, ['actionA'].concat(args))
    }
    actionB(...args){
      return this.$store._modulesNamespaceMap.['ruochuan/'].context.commit.apply(this.$store, ['actionB'].concat(args))
    }
  }
}
```



## createNamespacedHelpers

创建基于命名空间的组件绑定辅助函数

```js
/**
 * @param {String} namespace
 * @return {Object}
 */
export const createNamespacedHelpers = namespace => ({
  // bind(null) 严格模式下，mapState等的函数 this 指向就是 null
  mapState: mapState.bind(null, namespace),
  mapGetters: mapGetters.bind(null, namespace),
  mapMutations: mapMutations.bind(null, namespace),
  mapActions: mapActions.bind(null, namespace)
});
```

