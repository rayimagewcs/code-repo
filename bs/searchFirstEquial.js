const assert = require('assert')

/**
 * 
 *  二分查找变体，查询第一个等于目标数的索引，（数组元素可重复）要求条件：
 * 1、数组已排序；
 * 
 * @param {Number[]} nums 
 * @param {Number} target 
 */
var bs = (nums, target) => {
  let len = nums.length - 1, l = 0, h = len
  while (l <= h) {
    const mid = Math.floor((h - l) / 2) + l
    if (nums[mid] === target) {
      if (mid === 0 || nums[mid-1] !== target) return mid
      h = mid - 1
    } else if (nums[mid] > target)
      h = mid - 1
    else
      l = mid + 1
  }

  return -1
}

/**
 * test code
 */
idx = bs([1,2,3,4,4,4,4,5], 4)
console.log(idx)
assert(idx === 3, 'bs search error')

idx = bs([1,1,1,1], 1)
console.log(idx)
assert(idx === 0, 'bs search error')

idx = bs([1,2,2,2,2], 2)
console.log(idx)
assert(idx === 1, 'bs search error')

idx = bs([1,2,2,2,2,4,4,4,4], 3)
console.log(idx)
assert(idx === -1, 'bs search error')

idx = bs([1], 3)
console.log(idx)
assert(idx === -1, 'bs search error')
