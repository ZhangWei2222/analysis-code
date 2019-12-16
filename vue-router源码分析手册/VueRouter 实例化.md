## VueRouter 构造函数

创建一个路由匹配对象，根据`mode`来采取不同的路由方式

```js
constructor(options: RouterOptions = {}) {
  this.app = null;
  this.apps = [];
  this.options = options;
  this.beforeHooks = [];
  this.resolveHooks = [];
  this.afterHooks = [];
  // 路由匹配对象
  this.matcher = createMatcher(options.routes || [], this);

  // 根据 mode 采取不同的路由方式
  let mode = options.mode || "hash";
  this.fallback =
    mode === "history" && !supportsPushState && options.fallback !== false;
  if (this.fallback) {
    mode = "hash";
  }
  if (!inBrowser) {
    mode = "abstract";
  }
  this.mode = mode;

  switch (mode) {
    case "history":
      this.history = new HTML5History(this, options.base);
      break;
    case "hash":
      this.history = new HashHistory(this, options.base, this.fallback);
      break;
    case "abstract":
      this.history = new AbstractHistory(this, options.base);
      break;
    default:
      if (process.env.NODE_ENV !== "production") {
        assert(false, `invalid mode: ${mode}`);
      }
  }
}
```

