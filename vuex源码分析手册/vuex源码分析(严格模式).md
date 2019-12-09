# 严格模式

```js
const store = new Vuex.Store({
  strict: true
)}
```

在`Store`类的option中设置`strict`参数为true，严格模式下，所有修改state的操作必须通过mutation实现，否则会抛出错误。

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

**作用：**利用vm去watch state，在被修改时进入回调；通过assert断言检测store._committing，如果为false，触发断言，抛出异常

在Store构造类的commit方法内，执行mutation的语句是这样的

```js
this._withCommit(() => {
    entry.forEach(function commitIterator(handler) {
    handler(payload);
  });
});
```

## _withCommit

```js
/* 调用withCommit修改state的值时会将store的committing值置为true，内部会有断言检查该值，在严格模式下只允许使用mutation来修改store中的值，而不允许直接修改store的数值 */
_withCommit(fn) {
  const committing = this._committing;
  this._committing = true;
  fn();
  this._committing = committing;
}
```

store.\_committing默认为false，这里控制执行mutation修改state时，会变成true，所以严格模式下就不会报错。如果不是在mutation修改，store._committing就还是false，抛出异常


