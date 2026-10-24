<?php

namespace Tests\Unit;

use App\Support\Money;
use PHPUnit\Framework\TestCase;

class MoneyTest extends TestCase
{
    public function test_amounts_are_formatted_in_quetzales(): void
    {
        $this->assertSame('Q1,234.56', Money::format(1234.56));
        $this->assertSame('-Q1,000.00', Money::format('-1000'));
        $this->assertSame('Q0.00', Money::format(0));
    }
}
