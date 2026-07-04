import type { ImgHTMLAttributes } from 'react';

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt'>;

export default function AppLogoIcon(props: Props) {
    return <img {...props} src="/favicon.svg" alt="" aria-hidden="true" />;
}
