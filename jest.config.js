const { jestConfig } = require('@salesforce/sfdx-lwc-jest/config');

module.exports = {
    ...jestConfig,
    modulePathIgnorePatterns: ['<rootDir>/.localdevserver'],
    moduleNameMapper: {
        ...jestConfig.moduleNameMapper,
        '^lightning/platformShowToastEvent$': '<rootDir>/__mocks__/lightning/platformShowToastEvent.js',
        '^lightning/navigation$': '<rootDir>/__mocks__/lightning/navigation.js',
        '^lightning/platformResourceLoader$': '<rootDir>/__mocks__/lightning/platformResourceLoader.js',
        '^@salesforce/apex/D3ChartController.executeQuery$': '<rootDir>/__mocks__/@salesforce/apex/D3ChartController.executeQuery.js',
        '^@salesforce/apex/D3ChartController.getAggregatedData$': '<rootDir>/__mocks__/@salesforce/apex/D3ChartController.getAggregatedData.js',
        '^@salesforce/apex/D3ChartController.getStatistics$': '<rootDir>/__mocks__/@salesforce/apex/D3ChartController.getStatistics.js',
        '^@salesforce/apex/D3ChartController.getCorrelation$': '<rootDir>/__mocks__/@salesforce/apex/D3ChartController.getCorrelation.js'
    }
};
