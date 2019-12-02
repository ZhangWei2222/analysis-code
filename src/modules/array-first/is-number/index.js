/*!
 * is-number <https://github.com/jonschlinkert/is-number>
 *
 * Copyright (c) 2014-2015, Jon Schlinkert.
 * Licensed under the MIT License.
 */

"use strict";

var typeOf = require("kind-of");

export default function isNumber(num) {
  var type = typeOf(num);
  // 必须是number或string类型
  if (type !== "number" && type !== "string") {
    return false;
  }

  // 添加+号，把字符串迅速转换成数字
  var n = +num;
  // 处理特殊情况：typeof(NaN/Infinity) = number 或 typeod('template literal') = string
  return n - n + 1 >= 0 && num !== "";
}
