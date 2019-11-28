/*!
 * array-first <https://github.com/jonschlinkert/array-first>
 *
 * Copyright (c) 2014 Jon Schlinkert, contributors.
 * Licensed under the MIT license.
 */

var isNumber = require("is-number");
var slice = require("array-slice");

export default function arrayFirst(arr, num) {
  // 必须是数组
  if (!Array.isArray(arr)) {
    throw new Error("array-first expects an array as the first argument.");
  }

  if (arr.length === 0) {
    return null;
  }
  console.log(num, +num);
  var first = slice(arr, 0, isNumber(num) ? +num : 1);
  if (+num === 1 || num == null) {
    return first[0];
  }
  return first;
}
