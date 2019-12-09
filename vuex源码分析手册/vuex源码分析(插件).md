# 插件

`vuex/src/plugins/devtool`

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

如果安装了devtool插件，会在windows对象上暴露一个**VUE_DEVTOOLS_GLOBAL_HOOK**，可以用`window.__VUE_DEVTOOLS_GLOBAL_HOOK__`打印出来。

vuex在初始化的时候，会触发“vuex:init”事件通知插件，然后通过on方法监听“vuex:travel-to-state”事件来重置state。最后通过Store的subscribe方法来添加一个订阅者，在触发commit方法修改mutation数据以后，该订阅者会被通知，从而触发“vuex:mutation”事件。