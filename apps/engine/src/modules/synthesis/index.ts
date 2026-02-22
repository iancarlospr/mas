/**
 * Synthesis module barrel file.
 *
 * Importing this file causes all synthesis-phase modules to self-register
 * their execute functions with the ModuleRunner via registerModuleExecutor().
 */

import './m41-module-synthesis.js';
import './m42-final-synthesis.js';
import './m43-prd-generation.js';
import './m44-roi-simulator.js';
import './m45-cost-cutter.js';
