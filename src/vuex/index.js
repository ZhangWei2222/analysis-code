import { Store, install } from "./store";
import {
  mapState,
  mapMutations,
  mapGetters,
  mapActions,
  createNamespacedHelpers
} from "./helpers";

export default {
  // 主要代码，状态存储类
  Store,
  // 插件安装
  install,
  // 版本
  version: "__VERSION__",
  mapState,
  mapMutations,
  mapGetters,
  mapActions,
  createNamespacedHelpers
};
