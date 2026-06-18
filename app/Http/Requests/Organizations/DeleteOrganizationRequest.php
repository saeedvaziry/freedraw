<?php

namespace App\Http\Requests\Organizations;

use App\Models\Organization;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Validator;

class DeleteOrganizationRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return Gate::allows('delete', $this->route('organization'));
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string'],
        ];
    }

    /**
     * Configure the validator instance.
     *
     * @return array<int, Closure(Validator): void>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                if ($this->input('name') !== $this->organization()->name) {
                    $validator->errors()->add('name', __('The organization name does not match.'));
                }
            },
        ];
    }

    /**
     * Get the organization associated with the request.
     */
    private function organization(): Organization
    {
        $organization = $this->route('organization');

        abort_if(! $organization instanceof Organization, 404);

        return $organization;
    }
}
