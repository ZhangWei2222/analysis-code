import Vue from "vue";
import Router from "vue-router";
import HelloWorld from "@/components/HelloWorld";
import Count from "@/components/Count";
import title1 from "@/components/title1";

Vue.use(Router);

export default new Router({
  routes: [
    {
      path: "/to",
      name: "HelloWorld",
      component: HelloWorld,
      children: [
        {
          path: "title1",
          name: "title1",
          component: title1,
          alias: "999"
        }
      ]
    }
    // {
    //   path: "/count",
    //   name: "count",
    //   component: Count
    // }
  ]
});
