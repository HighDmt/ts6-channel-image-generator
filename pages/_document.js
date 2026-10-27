import {ServerStyleSheet} from 'styled-components'
import Document, {Head, Html, Main, NextScript} from 'next/document'

export default class MyDocument extends Document {
    static async getInitialProps(ctx) {
        const sheet = new ServerStyleSheet()
        const originalRenderPage = ctx.renderPage

        try {
            ctx.renderPage = () =>
                originalRenderPage({
                    enhanceApp: (App) => (props) =>
                        sheet.collectStyles(<App {...props} />),
                })

            const initialProps = await Document.getInitialProps(ctx)
            return {
                ...initialProps,
                styles: (
                    <>
                        {initialProps.styles}
                        {sheet.getStyleElement()}
                    </>
                ),
            }
        } finally {
            sheet.seal()
        }
    }

    render() {
        return (
            <Html>
                <Head>
                    <meta property={'description'} content={`Tool for generating background cover images for channels in
                     the TeamSpeak 6 client. Upload any image and it will be split into multiple images that you
                     can simply use as banners on your channels.`}/>

                    <meta property="og:title" content="TeamSpeak 6 Channel Image Generator"/>
                    <meta property="og:url" content="https://highdmt.github.io/ts6-channel-image-generator/"/>
                    <meta property="og:description" content="Tool for generating background cover images for channels in
                    the TeamSpeak 6 client. Upload any image and it will be split into multiple images that you "/>
                    <meta property="og:type" content="website"/>
                </Head>

                <body className={'bp3-dark'}>
                <Main/>
                <NextScript/>
                </body>
            </Html>
        )
    }
}