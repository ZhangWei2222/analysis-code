12.5

看完源码后，脑子还是比较乱，通过给自己提问题理清思路



### 疑问1：vuex的store是如何挂载注入到组件中呢？？

首先在`store/index.js`里面安装`vuex`

```js
import Vuex from 'vuex';
Vue.use(vuex);// vue的插件机制
```

其中`Vue.use(vuex);`是利用了vue的插件机制，会调用vuex的Install方法，装载vuex，install方法里有一个applyMixin方法使用vue混入机制，在beforeCreated钩子函数内混入vueInit方法，VueInit方法实现store注入vue组件实例，并注册vuex store的引用属性$store

![图片描述](http://img.mukewang.com/5d5813ab0001a8b910021104.png)



### 疑问2：为啥可以通过this.$store.dispatch等调用方法？？

因为每个组件(vue实例)在`beforeCreate`生命周期(1.x在_init方法中)混入`vuexInit()`，将同一个Store实例作为vue实例属性`$store`



### 疑问3：怎么实现state响应式的？？
在 resetStoreVM()里面，通过vm重设store，新建Vue对象使用Vue内部的响应式实现注册state以及computed
```js
function resetStoreVM (store, state, hot) {
//  省略若干代码
store._vm = new Vue({
  data: {
  	$$state: state
  },
  computed
  })
  //  省略若干代码
}
```
然后我们在获取state的时候，就拿的是` vm.$_store._vm._data.$$state`，这个变量是响应式的



### 疑问4：为啥actions中可以处理异步函数？vuex需要项目支持promise，不支持会在创建store实例时报错？？

在源码 注册mutation registerAction中，判断了函数是否是一个Promise，不是Promise会把它Promise化



### 疑问5：为啥要用commit提交mutation来修改state呢？？

试验了一下：非严格模式下，直接修改state，是不会报错的，但是vue调试工具无法记录每一次state的变化。严格模式下，直接修改state，会报错。

源码中，严格模式下，会watch state的变化然后断言store._committing的值，默认为false，如果直接修改state，这个值就是false，就会报错。执行c ommit提交，在commit函数内部，由this.\_commit()函数来修改state，this.\_commit()函数会把store._committing设置成true，再修改state，所以严格模式下不会报错。

所以，我们最好设置成严格模式，使用commit修改state，这样不会报错且vue调试工具能够记录每次state的变化，方便调试



### 疑问6：为啥把异步操作放在actions，同步放在mutations？？

试验了一下：把mutations里面的操作改成Promise 3秒后执行，然后直接commit，发现也可以执行成功(严格模式下会报错)，但是devtools追踪的状态不准，无法捕捉是什么时候变化。

根据尤雨溪在知乎的回答，说明：这样做的原因是为了能用 devtools 追踪状态变化。事实上在 vuex 里面 actions 只是一个架构性的概念，并不是必须的，说到底只是一个函数，在里面想干嘛都可以，只要最后触发 mutation 就行。

vuex 真正限制你的只有 mutation 必须是同步的这一点，同步的意义在于每一个 mutation 执行完成后都可以对应到一个新的状态，这样 devtools 就可以清准的打出state的变化。

如果开着 devtool 调用一个异步的 action，就可以清楚地看到它所调用的 mutation 是何时被记录下来的，并且可以立刻查看它们对应的状态。

同时把异步操作放在actions，也可以更清晰的管理mutations

