<template>
  <div id="app">
    <img src="./assets/logo.png" />
    <router-view />
  </div>
</template>

<script>
export default {
  name: "App",
  mounted() {
    function decorateArmour(target, key, descriptor) {
      // taget 装饰的对象，这里是 Man类
      // key 被装饰的具体方法，这里是 init
      // descriptor 方法特性值的描述对象，这里返回的是
      /*{
    configurable: true
    enumerable: false
    value: ƒ init(def, atk, hp)
    writable: true
    __proto__: Object
  }
  */
      const method = descriptor.value;
      let moreDef = 100;
      let ret;
      descriptor.value = (...args) => {
        args[0] += moreDef;
        ret = method.apply(target, args);
        return ret;
      };
      return descriptor;
    }
    // 增加飞行能力
    function addFly(canFly) {
      return function(target) {
        console.log(target);
        // target 装饰的对象，这里是 Man类
        target.canFly = canFly;
        let extra = canFly ? "(增加飞行能力)" : "";
        let method = target.prototype.toString;
        target.prototype.toString = (...args) => {
          return method.apply(target.prototype, args) + extra;
        };
        return target;
      };
    }

    @addFly(true)
    class Man {
      constructor(def = 2, atk = 3, hp = 3) {
        this.init(def, atk, hp);
      }

      @decorateArmour
      init(def, atk, hp) {
        this.def = def; // 防御值
        this.atk = atk; // 攻击力
        this.hp = hp; // 血量
      }
      toString() {
        return `防御力:${this.def},攻击力:${this.atk},血量:${this.hp}`;
      }
    }

    var tony = new Man();

    console.log(`tony:当前状态 ===> `, tony.toString());
  }
};
</script>

<style>
#app {
  font-family: "Avenir", Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}
</style>
