/**
 * 抛出一个异常
 * @param condition
 * @param s
 */
const invariant = (condition, s) => {
  if (!condition) throw new Error(s);
};

/**
 * 模仿 Python 的分片操作 分割
 * @param v
 * @param start
 * @param end
 * @param step
 * @returns {Array}
 */
const slice = (v, start, end, step) => {
  const r = [];
  let i;
  if (step > 0) {
    for (i = start; i < end; i += step) {
      r.push(v[i]);
    }
  } else {
    for (i = start; i > end; i += step) {
      r.push(v[i]);
    }
  }
  return r;
};

/**
 * parse a string / number to number.
 *
 * parseInt('') === NaN
 * Number('') === 0
 * @param n
 */
const parseNumber = n => (isNaN(parseInt(n)) ? NaN : Number(n));

/**
 * parse slice string
 * start:end:stepß
 * @param path
 * @param l
 * @returns {*[]}
 */
const parseSliceString = (path, l) => {
  // 把字符如 ’2：4：2‘ 分割开来，弄成start end step，没有传入的为undefined或NaN
  let [start, end, step] = path.split(":").map(s => parseNumber(s));
  // 没有传入start，即':3'时，赋默认值
  start = isNaN(start) ? 0 : start < 0 ? l + start : start;
  // 没有传入end，即'3:'，赋默认值
  end = isNaN(end)
    ? l
    : end < 0
    ? l + end // 小于 0 转成正数
    : end > l
    ? l
    : end; // 最大为长度
  // 没有传step，即'3:2'，赋默认值
  step = isNaN(step) ? 1 : step;

  invariant(step !== 0, "Step can not be zero!");
  // invariant(step > 0, "Step 不能小于0!");

  return [start, end, step];
};

/**
 * slice entry 方法
 * @param v
 * @returns {Proxy}
 */
export default v => {
  // 校验输入必须为字符串或者数组
  invariant(
    typeof v === "string" || Array.isArray(v),
    "Only string and array can be sliced!"
  );

  return new Proxy(
    {},
    {
      get: (_, path) => {
        const l = v.length;
        // 检测输入的分隔符是否是数字，比如-2或者 '2:5:3'，如果是数字直接返回
        const n = Number(path);
        if (isNaN(n)) {
          // 如果分隔符不是一个数字，用slice()分割
          const r = slice(v, ...parseSliceString(path, l));
          // 处理一下返回值
          return Array.isArray(v) ? r : r.join("");
        }
        // 分割符为正数，直接返回v[n]，如果不是正数，返回v[n+l] 即倒数第n个数
        // 注意 n=2，输出的是v[2]，n=-2，输出的是v[l-2]，倒数第2个数，不太一样
        return v[n < 0 ? n + l : n];
      }
    }
  );
};
