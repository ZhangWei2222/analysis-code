# analysis-code

跟随 awesome-micro-npm-packages 库 的脚步，决定不定时更新对小库的代码分析

## 11.28

### slice.js

#### 介绍

按照输入的参数截取数组或者字符串，参数可以是数字，或者字符 ‘开始:结尾:step’

#### 使用

```js
$ npm install slice.js

import slice from 'slice.js';
// for array， string一样
const arr = slice([1, '2', 3, '4', 5, '6', 7, '8', 9, '0']);
arr[-2];  		// 9
arr['2:5'];  		// [3, '4', 5]
arr[':-2'];  		// [1, '2', 3, '4', 5, '6', 7, '8']
arr['-2:'];  		// [9, '0']
arr['1:5:2'];  		// ['2', '4']
arr['5:1:-2'];  	// ['6', '4']
```

#### 代码逻辑

1. If 不为数组或者字符串，throw 出错误
2. 使用 Proxy 代理，重构 get 方法
   1. 检测输入的分隔符是否是数字，比如-2 或者 '2:5:3'
      1. if 是数字：正数，直接返回 v[n]，如果不是正数，返回 v[n+l] 即倒数第 n 个数。注意 n=2，输出的是 v[2]，n=-2，输出的是 v[l-2]，倒数第 2 个数，不太一样
      2. else 是字符串
         1. 需要先处理一下字符串：把字符如 ’2：4：2‘ 分割开来，弄成 start end step，没有传入的为 undefined 或 NaN（需要赋默认值）
         2. 把处理好的 start end step，传入 slice()，循环 push 进结果数组

#### 学习

- new Proxy() 代理
- 扩展运算符+解构

- ```js
  const r = slice(v, ...parseSliceString(path, l));
  // parseSliceString() 返回 [start, end, step] slice可以接收住
  slice(v, start, end, step);
  ```

### is-sorted

#### 介绍

判断一个数组是否是顺序或者倒序的

#### 使用

```js
$ npm install --save is-sorted

var sorted = require('is-sorted')
console.log(sorted([1, 2, 3])) // => true
console.log(sorted([3, 1, 2])) // => false
// supports custom comparators
console.log(sorted([3, 2, 1], function (a, b) { return b - a })) // => true
```

#### 代码逻辑

1. If 不为数组，throw 出错误

2. 定义了一个默认的判断排序的方法：升序，可以传入自定义判断方法

3. 循环数组，调用判断方法，假如 不满足 则返回 false

   ```js
   // 默认判断方法
   function defaultComparator(a, b) {
     return a - b;
   }
   // 循环判断 不管是哪种判断方法，都是小的减大的，升序a-b，降序b-a，所以出现大于0的时候，就跳出，说明不是顺序排序
   if (comparator(array[i - 1], array[i]) > 0) return false;
   ```

## 11.29

### array-first

#### 介绍

从头部截取指定个数的数组元素

#### 使用

```js
$ npm install --save array-last

var first = require('array-first');
first(['a', 'b', 'c', 'd', 'e', 'f']); //=> 'a'
first(['a', 'b', 'c', 'd', 'e', 'f'], 1); //=> 'a'
first(['a', 'b', 'c', 'd', 'e', 'f'], 3); //=> ['a', 'b', 'c']
```

#### 代码逻辑

1. If 不为数组，throw 出错误
2. If 数组长度为 0，返回 null
3. 把参数传入`slice库`，if 是数字或者字符数字，push（`slice库`实现的逻辑太繁琐，不如下面`array-last`简洁）
4. Else 默认截取头一位

#### 学习

- 使用了 `+num`，因为代码中判断数字的逻辑中，无论是 number 还是 string，返回的是布尔值，需要把字符数字转变成数字
- 使用了`var len = arr.length >>> 0;`无符号右移运算符，保证 len 有意义（为数字类型），且为正整数，在有效的数组范围内（0~0xFFFFFFFF）,且在无意义的情况下缺省值为 0

### array-last

#### 介绍

从尾部截取指定个数的数组元素

#### 使用

```js
$ npm install --save array-last

var last = require('array-last');
last(['a', 'b', 'c', 'd', 'e', 'f']); //=> 'f'
last(['a', 'b', 'c', 'd', 'e', 'f'], 1); //=> 'f'
last(['a', 'b', 'c', 'd', 'e', 'f'], 3); //=> ['d', 'e', 'f']
```

#### 代码逻辑

1. If 不为数组，throw 出错误

2. If 数组长度为 0，返回 null

3. If 输入的参数是 数字或者字符数字

   1. 定义辅助数组

   2. while 循环，赋值给辅助数组，最后返回

      ```js
      while (n--) {
        // n为输入的参数
        res[n] = arr[--len];
      }
      ```

4. Else 不是数字或者字符数字

   - 默认截取最后一位元素

#### 学习

- `while`的用法

## 12.2

### arr-flatten

#### 介绍

将多维数组一维化

#### 使用

```js
$ npm install --save arr-flatten

var flatten = require('arr-flatten');
flatten(['a', ['b', ['c']], 'd', ['e']]); //=> ['a', 'b', 'c', 'd', 'e']
```

#### 代码逻辑

1. 主函数`flat`里面递归，参数为：arr 和结果数组 res
2. 函数内循环遍历数组内的每个元素，if 元素是数组，那么递归`flat`，传入当前的元素及 res；else 把元素 push 到 res 内
3. 最后返回 res

## 12.3

开始对 `vuex` 源码解析：install，store
