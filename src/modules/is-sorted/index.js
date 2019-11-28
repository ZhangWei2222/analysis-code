function defaultComparator(a, b) {
  return a - b;
}

export default function checksort(array, comparator) {
  // 限制必须是array类型
  if (!Array.isArray(array))
    throw new TypeError("Expected Array, got " + typeof array);

  // 如果输入了新的判断方法，则用新的判断方法，否则用默认的
  comparator = comparator || defaultComparator;

  for (var i = 1, length = array.length; i < length; ++i) {
    // 不管是哪种判断方法，都是小的减大的，升序a-b，降序b-a，所以出现大于0的时候，就跳出，说明不是顺序排序
    if (comparator(array[i - 1], array[i]) > 0) return false;
  }

  return true;
}
