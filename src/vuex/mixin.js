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
