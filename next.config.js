const isProd = process.env.NODE_ENV === 'production'

module.exports = {
    basePath: isProd ? '/ts6-channel-image-generator' : '',
}