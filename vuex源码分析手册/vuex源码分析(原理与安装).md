# 原理

每个组件（也就是`Vue实例`）在`beforeCreate`的生命周期中都混入（Vue.mixin）同一个`Store实例` 作为属性 `$store`，所以我们能够使用`this.$store`；

里面有一个`resetStoreVM()方法`，通过vm重设store，新建Vue对象使用Vue内部的响应式实现注册state以及computed，我们在获取state的时候，拿的是` vm.$_store._vm._data.$$state`，这个变量是响应式的



# Vue.use 安装

因为`Vue`使用插件时，插件必须提供一个`install方法`

## install 函数

`vuex/src/store.js`

1. 防止Vuex被重复安装
2. 执行applyMixin，目的是执行vuexInit方法初始化Vuex
   - 如果是Vue1.0，Vuex会将`vuexInit`方法放入Vue的`_init`方法中
   - 如果是Vue2.0，则会将`vuexinit`混淆进Vue的`beforeCreacte`钩子中
   
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
## applyMixin 函数

`vuex/src/mixin.js`

**在vue的声明周期中进行vuex的初始化，并且对vue的各种版本进行了兼容。vuexInit就是对vuex的初始化。为什么我们能在使用vue.$store这种方法呢，因为在vuexInit中为vue的实例添加了$store属性**

```js
export default function(Vue) {
  // 判断Vue的版本
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


这里的store就是Vuex.Store，我们通常在store/index.js里面声明的：

```js
const store = new Vuex.Store({
  state: {
    count: 1
  }
)}
```

