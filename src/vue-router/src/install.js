// router-view router-link 组件
import View from "./components/view";
import Link from "./components/link";

// export 一个 Vue 引用
export let _Vue;

// 安装函数
export function install(Vue) {
  // 确保 install 调用一次
  if (install.installed && _Vue === Vue) return;
  install.installed = true;

  // 把 Vue 赋值给全局变量
  _Vue = Vue;

  const isDef = v => v !== undefined;

  // 从父节点拿到registerRouteInstance，注册路由实例
  const registerInstance = (vm, callVal) => {
    let i = vm.$options._parentVnode;
    // 这是一个类似链式调用的方式
    // 目的是确保能确定到this.$options._parentVnode.data.registerRouteInstance是不是存在？
    // 如果找到了那么就自然而然的把i赋值为这个方法，然后执行它
    if (
      isDef(i) &&
      isDef((i = i.data)) &&
      isDef((i = i.registerRouteInstance))
    ) {
      i(vm, callVal);
    }
  };

  // 给每个组件的 `beforeCreate`钩子函数 混入实现
  // 初始化路由
  Vue.mixin({
    beforeCreate() {
      // this.$options.router存在吗？==》 是不是已经绑定_routerRoot的根节点，只有根节点有this.$options.router
      if (isDef(this.$options.router)) {
        // 根节点的_routerRoot就是根节点的vue component
        this._routerRoot = this;
        // 赋值 _router
        this._router = this.$options.router;
        // 初始化路由
        this._router.init(this);
        // 监控 router数据变化，这里为更新router-view
        Vue.util.defineReactive(this, "_route", this._router.history.current);
      } else {
        // 如果没有这个属性 ==》 两种情况 还没绑定这个属性的根节点、不是根节点
        // 未绑定属性的根节点组件，（根节点组件怎么会有爸爸呢）它不存在$parent属性、所以还是指向了自己
        // 不是根节点组件，那就找它爸爸的_routerRoot属性，用它爸爸的
        // vue的子组件beforeCreate肯定晚于父组件beforeCreate所以
        // 所有的组件就像一棵组件树以一样大家，从根向所有树枝树杈去传递这个属性
        // 大家都是用一个属性所以每个组件的_routerRoot都是根节点组件
        this._routerRoot = (this.$parent && this.$parent._routerRoot) || this;
      }
      registerInstance(this, this);
    },
    destroyed() {
      registerInstance(this);
    }
  });

  // 注入 $router
  Object.defineProperty(Vue.prototype, "$router", {
    get() {
      return this._routerRoot._router;
    }
  });
  // 注入 $route
  Object.defineProperty(Vue.prototype, "$route", {
    get() {
      return this._routerRoot._route;
    }
  });

  // 全局注册组件 router-link 和 router-view
  Vue.component("RouterView", View);
  Vue.component("RouterLink", Link);

  const strats = Vue.config.optionMergeStrategies;
  // use the same hook merging strategy for route hooks
  strats.beforeRouteEnter = strats.beforeRouteLeave = strats.beforeRouteUpdate =
    strats.created;
}
