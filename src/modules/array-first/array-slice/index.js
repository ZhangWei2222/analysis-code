/*!
 * array-slice <https://github.com/jonschlinkert/array-slice>
 *
 * Copyright (c) 2014-2015, Jon Schlinkert.
 * Licensed under the MIT License.
 */

"use strict";

// start默认传了0，end可能是正数，可能是负数，可能没传
export default function slice(arr, start, end) {
  // 防止溢出，溢出为0
  var len = arr.length >>> 0;
  var range = [];

  start = idx(arr, start);
  end = idx(arr, end, len);

  while (start < end) {
    range.push(arr[start++]);
  }
  return range;
}

function idx(arr, pos, end) {
  var len = arr.length >>> 0;

  if (pos == null) {
    pos = end || 0;
  } else if (pos < 0) {
    pos = Math.max(len + pos, 0);
  } else {
    pos = Math.min(pos, len);
  }

  return pos;
}
