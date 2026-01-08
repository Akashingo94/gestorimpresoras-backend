const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const UserSchema = new mongoose.Schema({
    username: { type: String, required: true },
    password: { type: String, required: true }, 
    name: String,
    role: { type: String, enum: ['ADMIN', 'TECHNICIAN', 'PENDING'], default: 'PENDING' },
    email: { type: String, required: true },
    avatarUrl: { type: String, default: null },
    preferences: {
        type: {
            themeColor: {
                id: { type: String, default: 'green' },
                name: { type: String, default: 'Verde Esmeralda' },
                hex: { type: String, default: '#10b981' },
                twClass: { type: String, default: 'emerald' }
            },
            fontFamily: { type: String, default: 'Inter' },
            fontSize: { type: String, default: 'Normal' }
        },
        default: () => ({
            themeColor: { id: 'green', name: 'Verde Esmeralda', hex: '#10b981', twClass: 'emerald' },
            fontFamily: 'Inter',
            fontSize: 'Normal'
        })
    },
    deletedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: null }
}, { timestamps: true });

/**
 * Índices únicos parciales - Solo aplican a usuarios activos (no eliminados)
 * Esto permite reutilizar username/email de usuarios eliminados
 */
UserSchema.index(
    { username: 1 }, 
    { 
        unique: true, 
        partialFilterExpression: { deletedAt: null },
        name: 'username_unique_active'
    }
);

UserSchema.index(
    { email: 1 }, 
    { 
        unique: true, 
        partialFilterExpression: { deletedAt: null },
        name: 'email_unique_active'
    }
);

/**
 * Pre-save hook: Hash de contraseña antes de guardar
 * Solo hashea si la contraseña fue modificada
 */
UserSchema.pre('save', async function(next) {
    // Solo hashear si la contraseña fue modificada (o es nueva)
    if (!this.isModified('password')) {
        return next();
    }
    
    try {
        // Generar salt y hash
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

/**
 * Método de instancia: Comparar contraseñas
 * @param {string} candidatePassword - Contraseña a comparar
 * @returns {Promise<boolean>} True si la contraseña coincide
 */
UserSchema.methods.comparePassword = async function(candidatePassword) {
    try {
        return await bcrypt.compare(candidatePassword, this.password);
    } catch (error) {
        throw error;
    }
};

/**
 * Método estático: Autenticar usuario
 * @param {string} username - Username o email
 * @param {string} password - Contraseña
 * @returns {Promise<User|null>} Usuario si las credenciales son correctas
 */
UserSchema.statics.authenticate = async function(username, password) {
    try {
        // Verificar conexión de MongoDB
        if (this.db.readyState !== 1) {
            const error = new Error('Base de datos no disponible');
            error.name = 'MongooseServerSelectionError';
            throw error;
        }
        
        // Buscar usuario por username o email (excluir eliminados)
        const user = await this.findOne({
            $or: [
                { username: username.toLowerCase() },
                { email: username.toLowerCase() }
            ],
            deletedAt: null // Solo usuarios activos
        });
        
        if (!user) {
            return null;
        }
        
        // Verificar contraseña
        const isMatch = await user.comparePassword(password);
        return isMatch ? user : null;
    } catch (error) {
        // Propagar el error para que el controlador lo maneje
        throw error;
    }
};

/**
 * Método de instancia: Soft delete de usuario
 * @param {string} reason - Razón del rechazo/eliminación
 * @returns {Promise<User>} Usuario actualizado
 */
UserSchema.methods.softDelete = async function(reason = null) {
    this.deletedAt = new Date();
    if (reason) {
        this.rejectionReason = reason;
    }
    return await this.save();
};

/**
 * Método estático: Rechazar solicitud de usuario pendiente
 * @param {string} userId - ID del usuario a rechazar
 * @param {string} reason - Razón del rechazo
 * @returns {Promise<User>} Usuario rechazado
 */
UserSchema.statics.rejectPendingUser = async function(userId, reason) {
    const user = await this.findOne({ _id: userId, role: 'PENDING', deletedAt: null });
    
    if (!user) {
        throw new Error('Usuario no encontrado o no está pendiente');
    }
    
    return await user.softDelete(reason);
};

/**
 * Método estático: Restaurar usuario eliminado
 * @param {string} userId - ID del usuario a restaurar
 * @returns {Promise<User>} Usuario restaurado
 */
UserSchema.statics.restore = async function(userId) {
    const user = await this.findOne({ _id: userId, deletedAt: { $ne: null } });
    
    if (!user) {
        throw new Error('Usuario no encontrado o no está eliminado');
    }
    
    user.deletedAt = null;
    user.rejectionReason = null;
    return await user.save();
};

/**
 * Query helper: Filtrar solo usuarios activos (no eliminados)
 */
UserSchema.query.active = function() {
    return this.where({ deletedAt: null });
};

/**
 * Query helper: Filtrar solo usuarios eliminados
 */
UserSchema.query.deleted = function() {
    return this.where({ deletedAt: { $ne: null } });
};

UserSchema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.password;
    }
});

module.exports = mongoose.model('User', UserSchema);
