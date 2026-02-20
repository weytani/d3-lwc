// ABOUTME: Mock for D3ChartController.getCorrelation Apex method.
// ABOUTME: Returns default correlation result; tests override via mockResolvedValue.
export default jest.fn().mockResolvedValue({
  r: 0,
  slope: 0,
  intercept: 0,
  count: 0
});
