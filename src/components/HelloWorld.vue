<template>
  <div class="hello">
    {{testArray}}
    <div @click="click">点击</div>
  </div>
</template>

<script>
export default {
  name: "HelloWorld",
  data() {
    return {
      testArray: [{ value: "hello" }],
      count: 1
    };
  },
  mounted() {},
  methods: {
    click() {
      // 每次点击 字符串长度都以上一次为基础增加到5倍，拉大差异突出效果，并且之后在字符串头部加上count值做区分
      this.count *= 5;
      var str = new Array(this.count * 10).join(":");
      this.testArray.push({
        value: this.count + str
      });
    }
  }
};
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped></style>
