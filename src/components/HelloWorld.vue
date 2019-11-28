<template>
  <div class="hello"></div>
</template>

<script>
// import checksort from "../modules/is-sorted/index.js";
import arrayFirst from "../modules/array-first/index";
// import slice from "../modules/slice.js/src/index";

export default {
  name: "HelloWorld",
  data() {
    return {
      msg: "Welcome to Your Vue.js App"
    };
  },
  mounted() {
    // --- test is-sorted
    // console.log(checksort([1, 2, 3]));
    // --- test arrayFirst
    console.log(arrayFirst(["a", "b", "c", "d", "e", "f"], 3));
    // --- test slice.js
    // const arr = slice([1, "2", 3, "4", 5, "6", 7, "8", 9, "0"]);
    // console.log(arr["5:1:-2"]);
  }
};
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped></style>
