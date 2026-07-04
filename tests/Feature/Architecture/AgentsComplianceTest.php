<?php

use App\Models\Organization;
use App\Models\OrganizationInvitation;
use App\Models\Page;
use App\Models\User;
use Illuminate\Database\Eloquent\Attributes\Boot;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Attributes\UseFactory;
use Illuminate\Database\Eloquent\Attributes\UsePolicy;
use Illuminate\Database\Eloquent\Attributes\UseResource;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;

function project_php_classes(string $directory): array
{
    $basePath = base_path($directory);

    if (! is_dir($basePath)) {
        return [];
    }

    $files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($basePath));
    $classes = [];

    foreach ($files as $file) {
        if (! $file->isFile() || $file->getExtension() !== 'php') {
            continue;
        }

        $relativePath = Str::of($file->getPathname())
            ->after(base_path().DIRECTORY_SEPARATOR)
            ->replace(DIRECTORY_SEPARATOR, '\\')
            ->replaceEnd('.php', '');

        $classes[] = Str::of($relativePath)->replaceFirst('app\\', 'App\\')->toString();
    }

    sort($classes);

    return $classes;
}

function project_files(string $directory, array $extensions): array
{
    $basePath = base_path($directory);

    if (! is_dir($basePath)) {
        return [];
    }

    $files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($basePath));
    $paths = [];

    foreach ($files as $file) {
        if ($file->isFile() && in_array($file->getExtension(), $extensions, true)) {
            $paths[] = $file->getPathname();
        }
    }

    sort($paths);

    return $paths;
}

test('dto namespace replaces legacy data namespace', function () {
    expect(is_dir(app_path('Data')))->toBeFalse()
        ->and(is_dir(app_path('DTOs')))->toBeTrue();
});

test('form requests convert to dto objects', function () {
    foreach (project_php_classes('app/Http/Requests') as $class) {
        expect(is_subclass_of($class, FormRequest::class))->toBeTrue();

        $method = new ReflectionMethod($class, 'toDto');
        $returnType = $method->getReturnType();
        $returnTypes = $returnType instanceof ReflectionUnionType
            ? $returnType->getTypes()
            : [$returnType];

        foreach ($returnTypes as $type) {
            expect($type)->toBeInstanceOf(ReflectionNamedType::class)
                ->and($type->getName())->toStartWith('App\\DTOs\\');
        }
    }
});

test('actions accept dto objects through handle methods', function () {
    foreach (project_php_classes('app/Actions') as $class) {
        $method = new ReflectionMethod($class, 'handle');
        $parameters = $method->getParameters();
        $type = $parameters[0]?->getType();

        expect($type)->toBeInstanceOf(ReflectionNamedType::class)
            ->and($type->getName())->toStartWith('App\\DTOs\\');
    }
});

test('controllers do not contain inline validation or external facade integrations', function () {
    $forbidden = [
        'request->validate(',
        '->validate(',
        'Facades\\DB',
        'Facades\\Notification',
        'Facades\\Socialite',
    ];

    foreach (project_files('app/Http/Controllers', ['php']) as $path) {
        $contents = file_get_contents($path);

        foreach ($forbidden as $needle) {
            expect($contents)->not->toContain($needle);
        }
    }
});

test('models use laravel attribute metadata', function () {
    foreach ([Organization::class, OrganizationInvitation::class, Page::class, User::class] as $class) {
        $reflection = new ReflectionClass($class);

        expect($reflection->getAttributes(UseFactory::class))->not->toBeEmpty();
    }

    expect((new ReflectionClass(Organization::class))->getAttributes(UsePolicy::class))->not->toBeEmpty()
        ->and((new ReflectionClass(Organization::class))->getAttributes(UseResource::class))->not->toBeEmpty()
        ->and((new ReflectionClass(Page::class))->getAttributes(UsePolicy::class))->not->toBeEmpty()
        ->and((new ReflectionClass(Page::class))->getAttributes(UseResource::class))->not->toBeEmpty();

    $page = new ReflectionClass(Page::class);

    expect($page->getMethod('assignPublicId')->getAttributes(Boot::class))->not->toBeEmpty()
        ->and($page->getMethod('visibleTo')->getAttributes(Scope::class))->not->toBeEmpty();
});

test('frontend files are kebab case and avoid inline svg elements', function () {
    foreach (project_files('resources/js', ['ts', 'tsx']) as $path) {
        $basename = basename($path, '.'.pathinfo($path, PATHINFO_EXTENSION));
        $basename = Str::of($basename)->replaceEnd('.d', '')->toString();

        expect($basename)->toMatch('/^[a-z0-9]+(?:-[a-z0-9]+)*$/')
            ->and(file_get_contents($path))->not->toContain('<svg');
    }
});
