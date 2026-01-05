/**
 * Printer Parsers Index
 * Centraliza todos los parsers específicos por marca
 */

const { parseBrotherPrinter } = require('./brotherParser');
const { parseRicohPrinter } = require('./ricohParser');
const { parsePantumPrinter } = require('./pantumParser');
const { parseGenericPrinter } = require('./genericParser');

/**
 * Obtiene el parser apropiado según la marca
 */
function getParserForBrand(brand) {
  const brandUpper = brand ? brand.toUpperCase() : 'GENERIC';
  
  switch (brandUpper) {
    case 'BROTHER':
      return parseBrotherPrinter;
    case 'RICOH':
      return parseRicohPrinter;
    case 'PANTUM':
      return parsePantumPrinter;
    case 'HP':
    case 'CANON':
    case 'EPSON':
    case 'TOSHIBA':
    default:
      return parseGenericPrinter;
  }
}

module.exports = {
  getParserForBrand,
  parseBrotherPrinter,
  parseRicohPrinter,
  parsePantumPrinter,
  parseGenericPrinter
};
