<?php

namespace App\Http\Requests\Organizations;

use App\DTOs\Organizations\UpdateOrganizationMemberData;
use App\Enums\OrganizationRole;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateOrganizationMemberRequest extends FormRequest
{
    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'role' => ['required', 'string', Rule::in(array_column(OrganizationRole::assignable(), 'value'))],
        ];
    }

    public function toDto(): UpdateOrganizationMemberData
    {
        return new UpdateOrganizationMemberData(
            organization: $this->organization(),
            member: $this->member(),
            role: OrganizationRole::from($this->validated('role')),
        );
    }

    private function organization(): Organization
    {
        $organization = $this->route('organization');

        abort_unless($organization instanceof Organization, 404);

        return $organization;
    }

    private function member(): User
    {
        $user = $this->route('user');

        abort_unless($user instanceof User, 404);

        return $user;
    }
}
