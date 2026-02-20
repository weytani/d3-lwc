// ABOUTME: Mock for D3ChartController.getStatistics Apex method.
// ABOUTME: Returns empty statistics by default; tests override via mockResolvedValue.
export default jest.fn().mockResolvedValue({
  mean: 0,
  median: 0,
  stdDev: 0,
  count: 0,
  min: 0,
  max: 0
});
