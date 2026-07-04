<?php

namespace App\Http\Requests\Organizations;

use App\DTOs\Organizations\CreateOrganizationData;
use App\DTOs\Organizations\UpdateOrganizationData;
use App\Models\Organization;
use App\Models\User;
use App\Rules\OrganizationName;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class SaveOrganizationRequest extends FormRequest
{
    public function authorize(): bool
    {
        $organization = $this->route('organization');

        return ! $organization instanceof Organization
            || ($this->user()?->can('update', $organization) ?? false);
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255', new OrganizationName],
        ];
    }

    public function toDto(): CreateOrganizationData|UpdateOrganizationData
    {
        $organization = $this->route('organization');

        if ($organization instanceof Organization) {
            return new UpdateOrganizationData(
                organization: $organization,
                name: $this->validated('name'),
            );
        }

        return new CreateOrganizationData(
            user: $this->authenticatedUser(),
            name: $this->validated('name'),
        );
    }

    private function authenticatedUser(): User
    {
        $user = $this->user();

        abort_unless($user instanceof User, 403);

        return $user;
    }
}
