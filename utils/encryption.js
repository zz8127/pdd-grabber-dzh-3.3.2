const { safeStorage } = require('electron');

class EncryptionService {
    constructor() {
        this.isEncryptionAvailable = safeStorage.isEncryptionAvailable();
        if (!this.isEncryptionAvailable) {
            // 使用Buffer确保UTF-8编码输出，避免Windows控制台乱码
            const message = '系统加密不可用，将使用明文存储敏感信息';
            try {
                // 尝试使用process.stderr.write，可以更好控制编码
                if (process.stderr && process.stderr.write) {
                    process.stderr.write(Buffer.from(message + '\n', 'utf8'));
                } else {
                    console.warn(message);
                }
            } catch (err) {
                console.warn(message);
            }
        }
    }

    /**
     * 加密字符串
     * @param {string} plaintext 明文
     * @returns {string} base64编码的加密数据
     */
    encrypt(plaintext) {
        if (!this.isEncryptionAvailable || !plaintext) {
            return plaintext;
        }
        
        try {
            const buffer = safeStorage.encryptString(plaintext);
            return buffer.toString('base64');
        } catch (error) {
            console.error('加密失败:', error);
            return plaintext;
        }
    }

    /**
     * 解密字符串
     * @param {string} ciphertext base64编码的加密数据
     * @returns {string} 明文
     */
    decrypt(ciphertext) {
        if (!this.isEncryptionAvailable || !ciphertext) {
            return ciphertext;
        }
        
        try {
            // 检查是否为base64编码的加密数据（简单检查）
            if (!this.isBase64(ciphertext)) {
                // 可能已经是明文（旧数据或加密不可用时）
                return ciphertext;
            }
            
            const buffer = Buffer.from(ciphertext, 'base64');
            return safeStorage.decryptString(buffer);
        } catch (error) {
            console.error('解密失败，返回原始数据:', error);
            return ciphertext;
        }
    }

    /**
     * 检查字符串是否为base64编码
     */
    isBase64(str) {
        try {
            return Buffer.from(str, 'base64').toString('base64') === str;
        } catch (err) {
            return false;
        }
    }

    /**
     * 加密对象中的指定字段
     * @param {object} obj 要加密的对象
     * @param {string[]} fields 需要加密的字段名
     * @returns {object} 加密后的新对象
     */
    encryptFields(obj, fields) {
        if (!this.isEncryptionAvailable) {
            return { ...obj };
        }
        
        const result = { ...obj };
        for (const field of fields) {
            if (result[field] && typeof result[field] === 'string') {
                result[field] = this.encrypt(result[field]);
            }
        }
        return result;
    }

    /**
     * 解密对象中的指定字段
     * @param {object} obj 要解密的对象
     * @param {string[]} fields 解需要字段名密的
     * @returns {object} 解密后的新对象
     */
    decryptFields(obj, fields) {
        if (!this.isEncryptionAvailable) {
            return { ...obj };
        }
        
        const result = { ...obj };
        for (const field of fields) {
            if (result[field] && typeof result[field] === 'string') {
                result[field] = this.decrypt(result[field]);
            }
        }
        return result;
    }

    /**
     * 批量加密账号数据（用于导出/导入）
     */
    encryptAccountData(accountData) {
        const sensitiveFields = ['cookie', 'antiContent', 'pdduid', 'defaultAddressId', 'defaultGroupId', 'defaultActivityId'];
        return this.encryptFields(accountData, sensitiveFields);
    }

    /**
     * 批量解密账号数据
     */
    decryptAccountData(accountData) {
        const sensitiveFields = ['cookie', 'antiContent', 'pdduid', 'defaultAddressId', 'defaultGroupId', 'defaultActivityId'];
        return this.decryptFields(accountData, sensitiveFields);
    }
}

// 导出单例实例
module.exports = new EncryptionService();