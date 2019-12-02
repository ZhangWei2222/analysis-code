/*!
 * array-first <https://github.com/jonschlinkert/array-first>
 *
 * Copyright (c) 2014 Jon Schlinkert, contributors.
 * Licensed under the MIT license.
 */

import isNumber from "./is-number/index";
import slice from "./array-slice/index";

export default function arrayFirst(arr, num) {
  // 必须是数组
  if (!Array.isArray(arr)) {
    throw new Error("array-first expects an array as the first argument.");
  }

  if (arr.length === 0) {
    return null;
  }

  // 因为isNumber()返回的是一个布尔值，'1'也是返回true，所以要加个 +
  var first = slice(arr, 0, isNumber(num) ? +num : 1);
  if (+num === 1 || num == null) {
    return first[0];
  }
  return first;
}
