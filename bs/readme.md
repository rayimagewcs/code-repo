# 二分查找算法注意事项

```
如下只针对经典的二分查找，变体方式下可能不正确
1、循环退出条件： 是low <= high，而不是 low < high，否则可能会出现死循环;
2、nums[mid] > target 时，high = mid - 1，小于时类似;
3、取中间值的时候最好使用 mid = Math.floor((high - low) / 2) + low，而不是high + low,否则,如果 high和low非常大，则可能导致整型溢出；
```
