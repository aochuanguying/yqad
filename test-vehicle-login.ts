/**
 * 测试车辆登录功能
 */

import { md5 } from './src/services/vehicle-monitor-service';

const phone = '18561860357';
const password = '840507';
const mobileNum = '314B7D8BD81D6C969711D9B1120A474D';

console.log('测试 MD5 加密:');
console.log('密码:', password);
console.log('MD5:', md5(password));
console.log('');
console.log('登录参数:');
console.log('手机号:', phone);
console.log('设备号:', mobileNum);
console.log('MD5 密码:', md5(password));
