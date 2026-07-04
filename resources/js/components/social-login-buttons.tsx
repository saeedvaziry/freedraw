import { Github } from 'lucide-react';
import { Button } from '@/components/ui/button';

function GoogleIcon() {
    return (
        <span
            className="flex size-4 items-center justify-center rounded-full bg-background text-[13px] leading-none font-semibold text-foreground"
            aria-hidden="true"
        >
            G
        </span>
    );
}

export default function SocialLoginButtons() {
    return (
        <div className="flex flex-col gap-6">
            <div className="grid gap-3">
                <Button variant="outline" asChild className="w-full">
                    <a href="/login/github">
                        <Github className="size-4" />
                        Continue with GitHub
                    </a>
                </Button>

                <Button variant="outline" asChild className="w-full">
                    <a href="/login/google">
                        <GoogleIcon />
                        Continue with Google
                    </a>
                </Button>
            </div>

            <div className="relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border">
                <span className="relative z-10 bg-background px-2 text-muted-foreground">
                    Or continue with email
                </span>
            </div>
        </div>
    );
}
