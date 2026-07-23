import { useFlashToast } from '@/hooks/use-flash-toast';
import { useAppearance } from '@/hooks/use-appearance';
import { Toaster as Sonner, type ToasterProps } from 'sonner';

const panelSurface =
    'shadow-[var(--panel-shadow)]! backdrop-blur-[var(--panel-blur)] focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring)]';

function Toaster({ ...props }: ToasterProps) {
    const { appearance } = useAppearance();

    useFlashToast();

    return (
        <Sonner
            theme={appearance}
            className="toaster group"
            position="bottom-right"
            style={
                {
                    '--normal-bg': 'var(--panel-bg)',
                    '--normal-text': 'var(--foreground)',
                    '--normal-border': 'var(--panel-border)',
                    '--border-radius': 'var(--panel-radius)',
                } as React.CSSProperties
            }
            toastOptions={{ classNames: { toast: panelSurface } }}
            {...props}
        />
    );
}

export { Toaster };
