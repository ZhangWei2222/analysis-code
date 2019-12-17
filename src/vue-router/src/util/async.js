/* @flow */

export function runQueue(
  queue: Array<?NavigationGuard>,
  fn: Function,
  cb: Function
) {
  // 队列中的函数都执行完毕，就执行回调函数
  const step = index => {
    if (index >= queue.length) {
      cb();
    } else {
      if (queue[index]) {
        // 执行迭代器，用户在钩子函数中执行 next() 回调
        // 回调中判断传参，没有问题就执行 next()，也就是 fn 函数中的第二个参数
        fn(queue[index], () => {
          step(index + 1);
        });
      } else {
        step(index + 1);
      }
    }
  };
  // 取出队列中第一个钩子函数
  step(0);
}
