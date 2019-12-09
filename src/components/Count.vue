<template>
  <div class="count">
    {{ this.count }}
    <br />
    计算后：{{ this.getStateCount }}
    <hr />
    <button @click="add">+</button>
    <button @click="reduction">-</button>
  </div>
</template>

<script>
import { mapState, mapGetters, mapActions } from "vuex";

export default {
  name: "count",
  data() {
    return {};
  },
  computed: {
    ...mapState("a", { count: state => state.count }, ["count"]),
    // ...mapState(["count"]),
    ...mapGetters(["getStateCount"])
  },
  mounted() {
    // console.log(Vue.config.devtools);
    // this.$store.registerModule("c", {
    //   state: { count: 3 }
    // });
  },
  methods: {
    ...mapActions(["addFun", "reductionFun"]),
    add() {
      // this.addFun();
      // this.$store.unregisterModule("c");
      this.$store.commit("add");
      // this.$store.dispatch("addFun");
    },
    reduction() {
      // this.count--;
      // this.$store.state.count = this.$store.state.count - 2;
      // this.$store.watch(this.getStateCount);
      this.reductionFun();
      // this.$store.commit("reduction");
      // this.$store.dispatch("reductionFun");
    }
  }
};
</script>

<style scoped></style>
