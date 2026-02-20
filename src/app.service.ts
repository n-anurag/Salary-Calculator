import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  private round(value: number): number {
    return Math.round(value * 10) / 10; // 1 decimal place
  }

  calculateSalary(input: any) {
    const {
      totalSalary,
      totalDays,
      daysPresent,
      basicPercent,
      allowancePercent,
    } = input;

    // 1. Salary split
    const basic = totalSalary * (basicPercent / 100);
    const allowance = totalSalary * (allowancePercent / 100);

    // 2. Attendance (applied once)
    const basicEarned = (basic / totalDays) * daysPresent;
    const allowanceEarned = (allowance / totalDays) * daysPresent;

    // 3. Employee PF (10%)
    const employeePF = basicEarned * 0.10;

    // 4. Total Salary (Basic + Allowance + My PF)
    const totalSalaryWithPF =
      basicEarned + allowanceEarned + employeePF;

    // 5. Total PF (My 10% + Company 10%)
    const totalPF = employeePF * 2;

    // 6. Total B
    const totalB = totalSalaryWithPF - totalPF;

    // 7. SST (1% of Total B)
    const sst = totalB * 0.01;

    // 8. Net Salary Receivable
    const netSalary = totalB - sst;

    return {
      basicEarned: this.round(basicEarned),
      allowanceEarned: this.round(allowanceEarned),
      employeePF: this.round(employeePF),
      totalSalary: this.round(totalSalaryWithPF),
      totalPF: this.round(totalPF),
      totalB: this.round(totalB),
      sst: this.round(sst),
      netSalary: this.round(netSalary),
    };
  }
}
